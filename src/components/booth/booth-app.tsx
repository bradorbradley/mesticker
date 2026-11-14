"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { stylePresets } from "@/lib/presets";
import {
  BOOTH_FREE_MODE,
  BOOTH_FROM_LABEL,
  BOOTH_STYLE,
  SHEET_DESIGNS,
  SHEETS_PER_CASSETTE,
  STICKERS_PER_SHEET,
  bundlePrice,
  getSheet,
  priceLabel,
  type SheetKind,
} from "@/lib/booth-config";
import { addStickerBorder, composePrintSheet, slotPlacement, trimmedAspect } from "@/lib/booth-print";
import { sounds } from "@/lib/booth-sounds";
import { cn } from "@/lib/utils";
import Mascot from "./mascot";
import BoothCamera from "./booth-camera";
import OperatorPanel, { type BoothSettings, type GenStats } from "./operator-panel";
import { u } from "./units";
import LoadingState from "@/components/loading-state";
import BoothReveal from "./booth-reveal";
import { WAIT_GAMES, ReadyTakeover, type WaitGameId } from "./games/wait-games";

type Step = "attract" | "camera" | "generating" | "reveal" | "sheets" | "printing" | "done";

/** The two sets of extra stickers made from the photo. */
type VariantKind = "pose" | "face";
/** 7 extras per set: null = still making, false = failed */
type Variants = Record<VariantKind, (string | null | false)[]>;
const EXTRAS = 7;
const SLOTS = Array.from({ length: EXTRAS }, (_, i) => i);
const EMPTY_VARIANTS: Variants = { pose: SLOTS.map(() => null), face: SLOTS.map(() => null) };
const SHEET_LAYOUT = "pack12" as const;

/** Expressions for the Big Feelings sheet (same pose ideas engine isn't needed). */
const EXPRESSIONS = [
  "laughing out loud, eyes squeezed shut, huge open-mouth smile",
  "winking with a finger-gun and a cheeky grin",
  "heart eyes, hands clasped, totally in love",
  "shocked and surprised, mouth wide open, hands on cheeks",
  "too cool, wearing dark sunglasses, smug smirk, arms crossed",
  "happy tears of joy, crying-laughing",
  "pouty grumpy face, arms crossed, cheeks puffed (cute, not mean)",
];

/**
 * What goes in each of a sheet's 12 slots (pack12 order: hero, 2 beside it,
 * then 3 rows of 3). "main" = their sticker; [kind, i] = extra i of that set.
 * Big slots get the strongest stickers; the small last row repeats favourites.
 */
type Src = "main" | [VariantKind, number];
const SHEET_RECIPES: Record<SheetKind, Src[]> = {
  pose: ["main", ["pose", 0], ["pose", 1], ["pose", 2], ["pose", 3], ["pose", 4], ["pose", 5], ["pose", 6], "main", ["pose", 0], ["pose", 3], ["pose", 5]],
  face: ["main", ["face", 0], ["face", 1], ["face", 2], ["face", 3], ["face", 4], ["face", 5], ["face", 6], "main", ["face", 0], ["face", 2], ["face", 4]],
  best: ["main", ["face", 0], ["pose", 0], ["pose", 1], ["face", 1], ["pose", 2], ["face", 2], ["pose", 3], ["face", 3], ["pose", 4], ["face", 4], "main"],
};

/** Raw sticker per slot: null while an extra is still being made (preview only); failed extras fall back to the main sticker. */
function sheetSources(kind: SheetKind, main: string, variants: Variants, preview: boolean): (string | null)[] {
  return SHEET_RECIPES[kind].map((s) => {
    if (s === "main") return main;
    const v = variants[s[0]][s[1]];
    return v ? v : v === null && preview ? null : main;
  });
}

/** One sticker placement for the print station: which sheet, which slot, where (inches from the printable area's top-left). */
export interface KitItem {
  sheet: number; // 0-based, in order of the guest's picks
  n: number; // slot number on that sheet's guide (1–12)
  src: string; // the sticker as it prints: transparent, with its white die-cut border
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bordered copies are slow to make; reuse them between the live preview and printing. */
const borderCache = new Map<string, Promise<string>>();
const bordered = (src: string) => {
  if (!borderCache.has(src)) {
    if (borderCache.size > 60) borderCache.clear();
    borderCache.set(src, addStickerBorder(src));
  }
  return borderCache.get(src)!;
};

/** One sheet exactly as it will print (pending extras drawn as placeholders when previewing). */
async function buildSheet(kind: SheetKind, main: string, variants: Variants, preview: boolean, numbers = false) {
  const srcs = await Promise.all(sheetSources(kind, main, variants, preview).map((s) => (s ? bordered(s) : Promise.resolve(null))));
  return composePrintSheet(srcs, SHEET_LAYOUT, { numbers });
}

/** Every sticker placement for the guest's sheets, for the print station. */
async function buildKit(sheets: SheetKind[], main: string, variants: Variants): Promise<KitItem[]> {
  const aspects = new Map<string, Promise<number>>();
  const aspect = (src: string) => {
    if (!aspects.has(src)) aspects.set(src, trimmedAspect(src));
    return aspects.get(src)!;
  };
  const perSheet = await Promise.all(
    sheets.map((kind, sheet) =>
      Promise.all(
        sheetSources(kind, main, variants, false).map(async (raw, i) => {
          const src = await bordered(raw!);
          return { sheet, n: i + 1, src, ...slotPlacement(SHEET_LAYOUT, i, await aspect(src)) };
        })
      )
    )
  );
  return perSheet.flat();
}

/** Style examples on the attract screen. */
const BOOTH_STYLES = stylePresets.filter((p) => p.id !== "custom");
const MAX_TRIES = 3; // generations per guest

/** Seconds of no touches before a screen gives up and returns to attract. */
const IDLE_SECONDS: Partial<Record<Step, number>> = {
  camera: 75,
  reveal: 180,
  sheets: 180,
  done: 60,
};

const SETTINGS_KEY = "mesticker-booth-settings";
const today = () => new Date().toISOString().slice(0, 10);

function loadSettings(): BoothSettings {
  const base: BoothSettings = { sheetsLeft: SHEETS_PER_CASSETTE, freeMode: BOOTH_FREE_MODE, salesToday: 0, salesDate: today() };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    const s = { ...base, ...saved };
    return s.salesDate === today() ? s : { ...s, salesToday: 0, salesDate: today() };
  } catch {
    return base;
  }
}

// Same lines as the web app's loading screen
const LOADING_LINES = [
  "Analyzing your photo...",
  "Teaching AI to draw you...",
  "Adding cartoon energy...",
  "Perfecting the details...",
  "Making you sticker-ready...",
];

/** Two-panel screen: side by side in landscape, stacked in portrait. */
function Split({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("flex h-full w-full items-center justify-center landscape:flex-row portrait:flex-col", className)}
      style={{ gap: u(3), padding: `0 ${u(4)} ${u(2.5)}` }}
    >
      {children}
    </div>
  );
}

export default function BoothApp() {
  const [step, setStep] = useState<Step>("attract");
  const [photo, setPhoto] = useState<string | null>(null);
  const [sticker, setSticker] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastGen, setLastGen] = useState<GenStats | null>(null);
  // numbered guide per picked sheet, shown while printing
  const [guides, setGuides] = useState<string[] | null>(null);
  const [kit, setKit] = useState<KitItem[] | null>(null);
  // one id per paid order, so reopening the kit never queues it twice
  const [printOrder, setPrintOrder] = useState<PrintOrder | null>(null);
  const [digitalUrl, setDigitalUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<BoothSettings | null>(null);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  // Sticker is done but the guest is mid-game: the "It's ready!" takeover plays first.
  const [stickerReady, setStickerReady] = useState(false);
  // the guest's cart: which of the three sheets (1–3)
  const [picked, setPicked] = useState<SheetKind[]>(["pose"]);
  const [emailOn, setEmailOn] = useState(false);
  const [autoEmailedTo, setAutoEmailedTo] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/booth/send")
      .then((r) => r.json())
      .then((d) => setEmailOn(!!d.email))
      .catch(() => {});
  }, []);
  const showReveal = useCallback(() => setStep("reveal"), []);

  // ---- Pose / Mix packs: 8 extra stickers, started the moment the photo is taken
  const [variants, setVariantsState] = useState<Variants>(EMPTY_VARIANTS);
  const variantsRef = useRef<Variants>(EMPTY_VARIANTS);
  const genId = useRef(0);
  const setVariant = (kind: VariantKind, i: number, v: string | false, id: number) => {
    if (id !== genId.current) return; // a newer photo/style replaced this one
    const next = { ...variantsRef.current, [kind]: variantsRef.current[kind].map((x, j) => (j === i ? v : x)) };
    variantsRef.current = next;
    setVariantsState(next);
  };
  const resetVariants = () => {
    genId.current += 1;
    variantJobs.current = {};
    ideasJob.current = null;
    variantPhoto.current = null;
    variantsRef.current = EMPTY_VARIANTS;
    setVariantsState(EMPTY_VARIANTS);
  };

  useEffect(() => setSettings(loadSettings()), []);
  const updateSettings = useCallback((patch: Partial<BoothSettings>) => {
    setSettings((s) => {
      const next = { ...(s ?? loadSettings()), ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setStep("attract");
    setPhoto(null);
    setSticker(null);
    setTries(0);
    setError(null);
    setGuides(null);
    setKit(null);
    setPrintOrder(null);
    setDigitalUrl(null);
    setPaid(false);
    setStickerReady(false);
    setPicked(["pose"]);
    setAutoEmailedTo(null);
    resetVariants();
    setOperatorOpen(false);
    printCopy.current = null;
  }, []);

  // ---- idle reset
  const lastTouch = useRef(Date.now());
  useEffect(() => {
    const touch = () => (lastTouch.current = Date.now());
    window.addEventListener("pointerdown", touch);
    return () => window.removeEventListener("pointerdown", touch);
  }, []);
  useEffect(() => {
    lastTouch.current = Date.now();
    const limit = IDLE_SECONDS[step];
    if (!limit || operatorOpen) return;
    const id = setInterval(() => {
      if (Date.now() - lastTouch.current > limit * 1000) reset();
    }, 1000);
    return () => clearInterval(id);
  }, [step, operatorOpen, reset]);

  // ---- generation
  // The guest waits only for a fast preview; a sharper print copy is made in
  // the background while they look and pay, and printing uses it if ready.
  const printCopy = useRef<Promise<string | null> | null>(null);
  const startPrintCopy = (image: string, resolvedStyle: string) => {
    printCopy.current = fetch("/api/booth/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, styleId: resolvedStyle, tier: "print" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.generatedImage as string | undefined) ?? null)
      .catch(() => null);
  };

  /** Bordered sticker → public URL for the guest's phone (QR / email). */
  const uploadDigital = (img: string) =>
    addStickerBorder(img)
      .then((bordered) =>
        fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: bordered }),
        })
      )
      .then((r) => r.json())
      .then((d) => {
        if (d.url) setDigitalUrl(d.url);
        return (d.url as string | undefined) ?? null;
      })
      .catch(() => null);

  /**
   * Make the 14 extra stickers from the original photo, in parallel with the
   * main one (all chibi): "pose" = 7 poses designed for this person by the
   * vision engine, "face" = 7 expressions. Both start at capture so all three
   * sheets fill in during the reveal. Each request retries once.
   */
  const ideasJob = useRef<Promise<string[]> | null>(null);
  const variantPhoto = useRef<string | null>(null);
  const variantJobs = useRef<Partial<Record<VariantKind, Promise<unknown>>>>({});
  const startVariants = (kind: VariantKind) => {
    const image = variantPhoto.current;
    if (!image || variantJobs.current[kind]) return;
    const id = genId.current;
    const post = (body: object) =>
      fetch("/api/booth/pose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
      );
    const retry = <T,>(fn: () => Promise<T>) => fn().catch(() => new Promise<T>((ok, no) => setTimeout(() => fn().then(ok, no), 3000)));
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const ideas: Promise<string[]> =
      kind === "face" ? Promise.resolve(EXPRESSIONS) : (ideasJob.current ??= retry(() => post({ photo: image })).then((d: { ideas: string[] }) => d.ideas));
    variantJobs.current[kind] = ideas
      .then((list) =>
        // stagger so 14 image requests don't all land in the same instant
        Promise.allSettled(
          SLOTS.map((i) =>
            wait(i * 350 + (kind === "face" ? 175 : 0))
              .then(() => retry(() => post({ photo: image, styleId: BOOTH_STYLE, idea: list[i % list.length] })))
              .then((d) => setVariant(kind, i, d.image, id))
              .catch(() => setVariant(kind, i, false, id))
          )
        )
      )
      .catch(() => SLOTS.forEach((i) => variantsRef.current[kind][i] === null && setVariant(kind, i, false, id)));
  };

  const startVariantsRef = useRef(startVariants);
  startVariantsRef.current = startVariants;

  const generate = useCallback(async (image: string) => {
    printCopy.current = null;
    resetVariants();
    setStickerReady(false);
    setStep("generating");
    setError(null);
    setSticker(null);
    setGuides(null);
    setTries((t) => t + 1);
    // main sticker first, then the 14 sheet stickers right behind it
    const main = fetch("/api/booth/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, styleId: BOOTH_STYLE }),
    });
    variantPhoto.current = image;
    startVariantsRef.current("pose");
    startVariantsRef.current("face");
    try {
      const res = await main;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSticker(data.generatedImage);
      setLastGen({ provider: data.provider, model: data.model, ms: data.ms });
      startPrintCopy(image, data.stylePreset);
      try {
        localStorage.setItem("mesticker-booth-gen-ms", String(data.ms));
      } catch {}
      setStickerReady(true);
      uploadDigital(data.generatedImage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("reveal");
    }
  }, []);

  // ---- printing: build the sheets, hand them to the print station, send the digital copy
  const startPrint = useCallback(
    async (checkoutId?: string) => {
      if (!sticker || !picked.length) return;
      const sheets = picked;
      setPaid(true);
      setPrintOrder({ id: newOrderId(), sheets, checkoutId: checkoutId ?? null });
      setStep("printing");
      try {
        // Prefer the sharper print copy; don't hold the printer more than 30s for it.
        const pending = printCopy.current;
        const hq = pending ? await Promise.race([pending, new Promise<null>((r) => setTimeout(() => r(null), 30000))]) : null;
        const main = hq || sticker;
        // the extras started with the photo; give stragglers up to 60s, and any
        // that failed print as the main sticker so every sheet still prints
        const needs = new Set<VariantKind>(sheets.flatMap((k) => (k === "best" ? ["pose", "face"] : [k])) as VariantKind[]);
        await Promise.race([
          Promise.all([...needs].map((k) => variantJobs.current[k])),
          new Promise((r) => setTimeout(r, 60000)),
        ]);
        const v = variantsRef.current;
        setGuides(await Promise.all(sheets.map((k) => buildSheet(k, main, v, false, true))));
        setKit(await buildKit(sheets, main, v));
        setSettings((s) => {
          if (!s) return s;
          const next = { ...s, sheetsLeft: Math.max(0, s.sheetsLeft - sheets.length), salesToday: s.salesToday + 1 };
          try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
        // the sharp copy replaces the preview for the phone QR, then email it to whoever paid
        const url = await uploadDigital(main);
        if (url && checkoutId && emailOn) {
          fetch("/api/booth/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: url, sessionId: checkoutId }),
          })
            .then((r) => r.json())
            .then((d) => d.sent && setAutoEmailedTo(d.to))
            .catch(() => {});
        }
      } catch (e) {
        console.error("print file failed", e);
      }
    },
    [sticker, picked, emailOn]
  );

  const outOfPaper = settings !== null && settings.sheetsLeft <= 0;
  const freeMode = settings?.freeMode ?? BOOTH_FREE_MODE;

  return (
    <div className="booth fixed inset-0 z-40 flex flex-col overflow-hidden">
      <TopBar
        step={step}
        canJump={(s) =>
          step !== "generating" && step !== "printing" && step !== "done" && step !== s &&
          (s === "camera" || ((s === "reveal" || s === "sheets") && !!sticker))
        }
        onJump={(s) => {
          sounds.tap();
          if (s === "camera") setPhoto(null);
          setStep(s);
        }}
        onSecret={() => setOperatorOpen(true)}
        onHome={step !== "attract" && step !== "printing" ? reset : undefined}
      />

      <main className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25 }}
          >
            {step === "attract" && (
              <Attract
                outOfPaper={outOfPaper}
                freeMode={freeMode}
                onStart={() => {
                  sounds.unlock();
                  sounds.tap();
                  document.documentElement.requestFullscreen?.().catch(() => {});
                  setStep("camera");
                }}
              />
            )}
            {step === "camera" && (
              <BoothCamera
                onBack={() => setStep("attract")}
                onCapture={(p) => {
                  setPhoto(p);
                  generate(p);
                }}
              />
            )}
            {step === "generating" && <Generating photo={photo} ready={stickerReady} onReveal={showReveal} />}
            {step === "reveal" && (
              <Reveal
                photo={photo}
                sticker={sticker}
                error={error}
                canRetry={tries < MAX_TRIES}
                onRetry={() => (photo ? generate(photo) : setStep("camera"))}
                onRetake={() => {
                  setPhoto(null);
                  setStep("camera");
                }}
                onNext={() => {
                  sounds.tap();
                  setStep("sheets");
                }}
              />
            )}
            {step === "sheets" && sticker && (
              <SheetShop
                sticker={sticker}
                variants={variants}
                picked={picked}
                freeMode={freeMode}
                sheetsLeft={settings?.sheetsLeft ?? SHEETS_PER_CASSETTE}
                onToggle={(id) => {
                  sounds.tap();
                  setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : SHEET_DESIGNS.map((d) => d.id).filter((x) => x === id || p.includes(x))));
                }}
                onBack={() => setStep("reveal")}
                onPaid={startPrint}
              />
            )}
            {step === "printing" && <PrintKit guides={guides} kit={kit} order={printOrder} onDone={() => setStep("done")} />}
            {step === "done" && <Done sticker={sticker} digitalUrl={digitalUrl} emailOn={emailOn} autoEmailedTo={autoEmailedTo} onFinish={reset} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {operatorOpen && settings && (
        <OperatorPanel
          settings={settings}
          update={updateSettings}
          lastGen={lastGen}
          canReprint={!!kit && step === "done"}
          canMarkPaid={(step === "reveal" || step === "sheets") && !!sticker && !paid && picked.length > 0}
          onReprint={() => kit && setStep("printing")}
          onMarkPaid={() => {
            setOperatorOpen(false);
            startPrint();
          }}
          onReset={reset}
          onClose={() => setOperatorOpen(false)}
        />
      )}
    </div>
  );
}

// ================================================================ top bar

const STEP_LABELS: { label: string; target: Step; steps: Step[] }[] = [
  { label: "Snap", target: "camera", steps: ["camera"] },
  { label: "Reveal", target: "reveal", steps: ["generating", "reveal"] },
  { label: "Sheets", target: "sheets", steps: ["sheets"] },
  { label: "Print", target: "printing", steps: ["printing", "done"] },
];

function TopBar({
  step,
  canJump,
  onJump,
  onSecret,
  onHome,
}: {
  step: Step;
  canJump: (s: Step) => boolean;
  onJump: (s: Step) => void;
  onSecret: () => void;
  onHome?: () => void;
}) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = STEP_LABELS.findIndex((s) => s.steps.includes(step));
  return (
    <header className="flex shrink-0 items-center justify-between" style={{ height: `max(56px, ${u(6.5)})`, padding: `0 ${u(3)}`, gap: u(1.5) }}>
      <div
        className="font-fun shrink-0 font-bold"
        style={{ fontSize: `max(17px, ${u(2.6)})` }}
        onPointerDown={() => (hold.current = setTimeout(onSecret, 2000))}
        onPointerUp={() => hold.current && clearTimeout(hold.current)}
        onPointerLeave={() => hold.current && clearTimeout(hold.current)}
        onContextMenu={(e) => e.preventDefault()}
      >
        Me<span className="pop">Sticker</span>
      </div>

      {current >= 0 && (
        <ol className="flex min-w-0 items-center" style={{ gap: u(0.6) }}>
          {STEP_LABELS.map((s, i) => {
            const jumpable = i !== current && canJump(s.target);
            return (
              <li key={s.label}>
                <button
                  disabled={!jumpable}
                  onClick={() => onJump(s.target)}
                  className={cn(
                    "chip flex min-h-[36px] items-center transition-colors",
                    i === current
                      ? "bg-[var(--purple)] text-white"
                      : jumpable
                        ? "bg-[#dcfce7] text-[#15803d] active:scale-95"
                        : i < current
                          ? "bg-[#dcfce7] text-[#15803d]"
                          : "bg-white/50 text-[#a8a4bd]"
                  )}
                  style={{ gap: u(0.5) }}
                >
                  <span>{i < current ? "✓" : i + 1}</span>
                  <span className={cn(i !== current && "max-[700px]:hidden")}>{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex shrink-0 justify-end" style={{ minWidth: u(10) }}>
        {onHome && (
          <button className="btn btn-soft" onClick={onHome}>
            ↺ <span className="max-[700px]:hidden">Start over</span>
          </button>
        )}
      </div>
    </header>
  );
}

// ================================================================ attract

const FLOATERS = ["⭐", "💖", "🌈", "⚡"];
// Corners and edges only, so they never sit on top of text.
const FLOATER_SPOTS: React.CSSProperties[] = [
  { left: "1%", top: "1%" },
  { right: "1%", top: "1%" },
  { left: "1%", bottom: "1%" },
  { right: "1%", bottom: "1%" },
];

function Attract({ onStart, outOfPaper, freeMode }: { onStart: () => void; outOfPaper: boolean; freeMode: boolean }) {
  const examples = BOOTH_STYLES.filter((s) => s.id !== "random").slice(0, 4);
  const spots = [
    { left: "2%", top: "4%", rotate: -12 },
    { right: "2%", top: "0%", rotate: 10 },
    { left: "0%", bottom: "6%", rotate: 8 },
    { right: "4%", bottom: "2%", rotate: -8 },
  ];
  return (
    <button className="relative h-full w-full text-left" onClick={onStart} disabled={outOfPaper}>
      {FLOATERS.map((e, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute opacity-70"
          style={{ fontSize: u(2.2), ...FLOATER_SPOTS[i] }}
          animate={{ y: [0, -14, 0], rotate: [0, 15, 0] }}
          transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
        >
          {e}
        </motion.span>
      ))}

      <Split>
        <div className="flex flex-col landscape:w-[50%] portrait:items-center portrait:text-center" style={{ gap: u(2) }}>
          <motion.span
            className="chip w-fit bg-[var(--yellow)] text-[var(--ink)]"
            animate={{ rotate: [-3, 3, -3] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          >
            {freeMode ? "🎉 Free today!" : `Stickers from ${BOOTH_FROM_LABEL} · ready in 2 min`}
          </motion.span>
          <h1 className="t-hero">
            Turn yourself into a <span className="pop">sticker!</span>
          </h1>
          <p className="t-lead max-w-[30ch]">Pick a cartoon style, snap a pic, and peel off real stickers printed right here.</p>

          {outOfPaper ? (
            <div className="t-h3 card w-fit" style={{ padding: `${u(1.2)} ${u(2.4)}` }}>
              🧻 Out of stickers — back in a minute!
            </div>
          ) : (
            <motion.div
              className="btn btn-lg btn-main w-fit"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              Tap to start ✨
            </motion.div>
          )}

          <ol className="flex flex-wrap short:hidden portrait:justify-center" style={{ gap: `${u(0.8)} ${u(1.6)}` }}>
            {["Pick a style", "Strike a pose", "Pay by phone", "Peel & stick"].map((t, i) => (
              <li key={t} className="t-body flex items-center" style={{ gap: u(0.6) }}>
                <span
                  className="font-fun flex items-center justify-center rounded-full bg-white font-bold text-[var(--purple)] shadow"
                  style={{ width: `max(24px, ${u(2.4)})`, height: `max(24px, ${u(2.4)})` }}
                >
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </div>

        <div className="relative flex items-center justify-center landscape:h-full landscape:flex-1 portrait:w-full portrait:min-h-0 portrait:flex-1">
          {examples.map((s, i) => (
            <motion.div
              key={s.id}
              className="card absolute overflow-hidden"
              style={{ ...spots[i], width: u(11), rotate: spots[i].rotate, padding: u(0.4) }}
              animate={{ y: [0, i % 2 ? 10 : -10, 0] }}
              transition={{ duration: 2.8 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.previewImage} alt={s.name} className="aspect-square w-full object-cover" style={{ borderRadius: u(1.4) }} />
            </motion.div>
          ))}
          <Mascot className="relative z-10 h-[80%] max-h-full" mood="idle" />
        </div>
      </Split>
    </button>
  );
}

// ================================================================ generating

function Generating({ photo, ready, onReveal }: { photo: string | null; ready: boolean; onReveal: () => void }) {
  const [game, setGame] = useState<WaitGameId>(() => WAIT_GAMES[Math.floor(Math.random() * WAIT_GAMES.length)].id);
  const [line, setLine] = useState(0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let expected = 25000;
    try {
      expected = Math.max(8000, Number(localStorage.getItem("mesticker-booth-gen-ms")) || 25000);
    } catch {}
    const t0 = Date.now();
    const id = setInterval(() => {
      const t = (Date.now() - t0) / expected;
      setProgress(Math.min(0.95, 1 - Math.exp(-2.2 * t)));
      setLine(Math.min(LOADING_LINES.length - 1, Math.floor(t * LOADING_LINES.length)));
    }, 200);
    return () => clearInterval(id);
  }, []);
  const Game = WAIT_GAMES.find((g) => g.id === game)!.Comp;

  const tabs = (
    <nav className="flex flex-wrap justify-center" style={{ gap: u(0.5) }}>
      {WAIT_GAMES.map((g) => (
        <button
          key={g.id}
          className={cn("chip min-h-[36px] whitespace-nowrap", g.id === game ? "bg-[var(--purple)] text-white" : "bg-[var(--lav)] text-[var(--ink)]")}
          onClick={() => {
            sounds.tap();
            setGame(g.id);
          }}
        >
          <span className="max-[700px]:hidden">{g.label}</span>
          <span className="min-[701px]:hidden">{g.short}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="relative flex h-full w-full flex-col landscape:flex-row short:!flex-col" style={{ padding: `0 ${u(3)} ${u(1)}`, gap: u(1) }}>
      {/* Laptop/booth: the web app's "generating" animation, with the game picker under it */}
      <div className="card hidden shrink-0 flex-col items-center justify-center overflow-hidden landscape:flex landscape:w-[30%] short:!hidden" style={{ padding: u(1) }}>
        <LoadingState photo={photo} className="!py-2" />
        <div className="t-body" style={{ marginBottom: u(0.8) }}>
          Play a game while you wait 👉
        </div>
        {tabs}
      </div>

      {/* Phones: compact strip with the spinning photo ring */}
      <div className="card flex shrink-0 flex-wrap items-center landscape:hidden short:!flex" style={{ gap: `${u(0.6)} ${u(1.2)}`, padding: `${u(0.5)} ${u(1)}` }}>
        {photo && (
          <div className="relative shrink-0" style={{ width: `max(40px, ${u(4.4)})`, height: `max(40px, ${u(4.4)})` }}>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: "conic-gradient(from 0deg, #7C5CFC, #FF6B9D, #FF9F43, #7C5CFC)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="absolute inset-[3px] h-[calc(100%-6px)] w-[calc(100%-6px)] rounded-full object-cover" />
          </div>
        )}
        <div className="flex min-w-[160px] flex-1 items-center" style={{ gap: u(1) }}>
          <span className="t-body shrink-0 font-bold text-[var(--ink)]">{ready ? "🎉 Ready!" : LOADING_LINES[line]}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--lav)]">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--pink)]" animate={{ width: `${(ready ? 1 : progress) * 100}%` }} />
          </div>
        </div>
        {tabs}
      </div>

      {/* play while you wait */}
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={game} className="absolute inset-0" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Game />
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>{ready && <ReadyTakeover onGo={onReveal} />}</AnimatePresence>
    </div>
  );
}

// ================================================================ reveal

function Reveal({
  photo,
  sticker,
  error,
  canRetry,
  onRetry,
  onRetake,
  onNext,
}: {
  photo: string | null;
  sticker: string | null;
  error: string | null;
  canRetry: boolean;
  onRetry: () => void;
  onRetake: () => void;
  onNext: () => void;
}) {
  if (error || !sticker) {
    return (
      <Split>
        <div className="flex items-center justify-center landscape:h-full landscape:w-[36%] portrait:w-full portrait:min-h-0 portrait:flex-1">
          <Mascot className="h-[75%] max-h-full" />
        </div>
        <div className="flex flex-col landscape:w-[48%] portrait:items-center portrait:text-center" style={{ gap: u(2) }}>
          <h2 className="t-h2">
            Oops! That one <span className="pop">didn&apos;t develop.</span>
          </h2>
          <p className="t-lead">Let&apos;s try again. You haven&apos;t been charged.</p>
          <div className="flex flex-wrap" style={{ gap: u(1.2) }}>
            {canRetry && (
              <button className="btn btn-lg btn-main" onClick={onRetry}>
                Try again
              </button>
            )}
            <button className="btn btn-soft" onClick={onRetake}>
              📸 New photo
            </button>
          </div>
        </div>
      </Split>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      <Split className="portrait:h-auto portrait:min-h-full portrait:justify-start portrait:pt-2">
        <div className="relative landscape:h-full landscape:w-[50%] portrait:h-[58vh] portrait:w-full portrait:shrink-0">
          <BoothReveal photo={photo} sticker={sticker} />
        </div>
        <div className="flex flex-col landscape:w-[42%] portrait:w-full portrait:items-center portrait:text-center" style={{ gap: u(1.8) }}>
          <h2 className="t-h2">
            Ta-da! <span className="pop">That&apos;s you.</span>
          </h2>
          <p className="t-lead">We made 3 whole sticker sheets from this photo, {STICKERS_PER_SHEET} stickers each.</p>
          <button className="btn btn-lg btn-main w-fit" onClick={onNext}>
            See my sticker sheets →
          </button>
          <div className="flex flex-wrap portrait:justify-center" style={{ gap: u(1) }}>
            {canRetry && (
              <button className="btn btn-soft" onClick={onRetry}>
                🔄 Redo
              </button>
            )}
            <button className="btn btn-soft" onClick={onRetake}>
              📸 New photo
            </button>
          </div>
        </div>
      </Split>
    </div>
  );
}

// ================================================================ sheets + pay

/** "Add 1 more for $8" — what the next sheet costs at the bundle price. */
function bundleHint(count: number) {
  if (count >= 3) return `Best deal: ${priceLabel(bundlePrice(1) * 3 - bundlePrice(3))} off`;
  if (count === 0) return `1 for ${priceLabel(bundlePrice(1))} · 2 for ${priceLabel(bundlePrice(2))} · 3 for ${priceLabel(bundlePrice(3))}`;
  return `Add ${count === 1 ? "another" : "the last one"} for just ${priceLabel(bundlePrice(count + 1) - bundlePrice(count))}`;
}

/**
 * The three sheets, as they will print (rendered by the same code that makes
 * the print file, re-rendered as each pose / expression arrives). Tap to add
 * or remove; price by count; pay by QR.
 */
function SheetShop({
  sticker,
  variants,
  picked,
  freeMode,
  sheetsLeft,
  onToggle,
  onBack,
  onPaid,
}: {
  sticker: string;
  variants: Variants;
  picked: SheetKind[];
  freeMode: boolean;
  sheetsLeft: number;
  onToggle: (id: SheetKind) => void;
  onBack: () => void;
  onPaid: (checkoutId?: string) => void;
}) {
  const [previews, setPreviews] = useState<Partial<Record<SheetKind, string>>>({});
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      SHEET_DESIGNS.forEach((d) =>
        buildSheet(d.id, sticker, variants, true)
          .then((img) => alive && setPreviews((p) => ({ ...p, [d.id]: img })))
          .catch(() => {})
      );
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [sticker, variants]);

  const pending = (["pose", "face"] as VariantKind[]).reduce((n, k) => n + variants[k].filter((v) => v === null).length, 0);
  const count = picked.length;
  const tooMany = count > sheetsLeft;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto overflow-x-hidden" style={{ gap: u(1), padding: `${u(1)} ${u(2)} ${u(1.4)}` }}>
      <div className="flex shrink-0 flex-wrap items-end justify-between" style={{ gap: u(1) }}>
        <h2 className="t-h2">
          Pick your <span className="pop">sheets</span>
        </h2>
        <div className="t-body">
          {pending > 0 ? `✨ Snap is still drawing ${pending} sticker${pending === 1 ? "" : "s"}: they pop in as they're ready` : `${STICKERS_PER_SHEET} stickers on every sheet`}
        </div>
      </div>

      <div className="grid min-h-[260px] flex-1 grid-cols-3" style={{ gap: u(1.6), containerType: "size" }}>
        {SHEET_DESIGNS.map((d, i) => {
          const on = picked.includes(d.id);
          return (
            <motion.button
              key={d.id}
              onClick={() => onToggle(d.id)}
              className={cn(
                "relative flex min-h-0 flex-col items-center rounded-3xl border-4 bg-white/70 transition-colors",
                on ? "border-[var(--purple)] bg-white shadow-[0_14px_40px_rgba(91,63,214,0.28)]" : "border-transparent"
              )}
              style={{ padding: u(0.8), gap: u(0.5) }}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 200, damping: 18 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                <div className="relative h-full max-w-full bg-white shadow-md" style={{ aspectRatio: "3.9 / 6.7", borderRadius: 10 }}>
                  {previews[d.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[d.id]} alt={`${d.name} sheet`} className="h-full w-full rounded-[10px]" />
                  ) : (
                    <div className="h-full w-full animate-pulse rounded-[10px] bg-[var(--lav)]" />
                  )}
                </div>
              </div>
              <div className="flex w-full items-center justify-between" style={{ gap: u(0.5) }}>
                <div className="text-left">
                  <div className="t-h3">
                    {d.emoji} {d.name}
                  </div>
                  <div className="t-body">{d.blurb}</div>
                </div>
                <span
                  className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", on ? "bg-[var(--purple)] text-white" : "bg-[var(--lav)] text-[var(--ink)]")}
                  style={{ width: u(3.2), height: u(3.2), fontSize: u(1.6) }}
                >
                  {on ? "✓" : "+"}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="card flex shrink-0 flex-wrap items-center justify-between" style={{ gap: u(1.4), padding: u(1.2) }}>
        <div className="flex flex-col" style={{ gap: u(0.3) }}>
          <div className="t-h3">
            {count ? `${count} sheet${count === 1 ? "" : "s"} · ${count * STICKERS_PER_SHEET} stickers` : "Tap a sheet to add it"}
          </div>
          <div className="t-body text-[#15803d]">{bundleHint(count)}</div>
          {tooMany && <div className="t-body text-[var(--pink)]">Only {sheetsLeft} sheet{sheetsLeft === 1 ? "" : "s"} of paper left — pick fewer</div>}
          <button className="btn btn-soft mt-1 w-fit" onClick={onBack}>
            ← Back
          </button>
        </div>
        {count > 0 && !tooMany &&
          (freeMode ? (
            <button className="btn btn-lg btn-main" onClick={() => onPaid()}>
              🖨️ Print {count === 1 ? "my sheet" : `my ${count} sheets`}
            </button>
          ) : (
            <PayWithQr key={picked.join("+")} sheets={picked} onPaid={onPaid} />
          ))}
      </div>
    </div>
  );
}

function PayWithQr({ sheets, onPaid }: { sheets: SheetKind[]; onPaid: (checkoutId?: string) => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "waiting" | "free" | "error">("loading");
  const paidRef = useRef(false);
  const price = bundlePrice(sheets.length);

  useEffect(() => {
    let alive = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    // guests often tap 2–3 sheets in a row: wait a beat before making a checkout
    const start = setTimeout(async () => {
      try {
        const res = await fetch("/api/booth/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheets }),
        });
        const data = await res.json();
        if (!alive) return;
        if (data.free) return setState("free");
        if (!res.ok || !data.url) throw new Error(data.error);
        setQr(await QRCode.toDataURL(data.url, { width: 560, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } }));
        setState("waiting");
        poll = setInterval(async () => {
          try {
            const r = await fetch(`/api/booth/checkout?id=${data.id}`);
            const s = await r.json();
            if (s.paid && !paidRef.current) {
              paidRef.current = true;
              clearInterval(poll);
              sounds.success();
              onPaid(data.id);
            }
          } catch {}
        }, 2000);
      } catch {
        if (alive) setState("error");
      }
    }, 600);
    return () => {
      alive = false;
      clearTimeout(start);
      if (poll) clearInterval(poll);
    };
  }, [sheets, onPaid]);

  if (state === "free") {
    return (
      <button className="btn btn-lg btn-main w-fit" onClick={() => onPaid()}>
        🖨️ Print my sheets
      </button>
    );
  }

  return (
    <div className="flex items-center" style={{ gap: u(1.4) }}>
      <div className="flex flex-col text-right" style={{ gap: u(0.3) }}>
        <div className="font-fun font-bold" style={{ fontSize: u(3.6), lineHeight: 1 }}>
          {priceLabel(price)}
        </div>
        <div className="t-h3">📱 Scan to pay</div>
        <div className="t-body">Apple Pay, Google Pay, card</div>
        {state === "waiting" && (
          <motion.div className="t-body text-[#15803d]" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
            ● Printing starts automatically
          </motion.div>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-center overflow-hidden bg-white" style={{ width: `max(110px, ${u(13)})`, height: `max(110px, ${u(13)})` }}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Scan to pay" className="h-full w-full" />
        ) : state === "error" ? (
          <span className="t-body text-center text-[var(--pink)]">Payment is down — please ask staff</span>
        ) : (
          <motion.span style={{ fontSize: u(4) }} animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            ✨
          </motion.span>
        )}
      </div>
    </div>
  );
}

// ================================================================ printing

/**
 * Printing = the hand-off to the print station (the Mac running StixCut).
 * Uploads each sticker once plus a numbered guide per sheet, and puts the
 * order on the print queue with every sticker's exact spot, while the guest
 * watches their sheets.
 */
type PrintOrder = { id: string; sheets: SheetKind[]; checkoutId: string | null };

const newOrderId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `o-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function PrintKit({ guides, kit, order, onDone }: { guides: string[] | null; kit: KitItem[] | null; order: PrintOrder | null; onDone: () => void }) {
  const [sent, setSent] = useState<"sending" | "queued" | "error">("sending");

  useEffect(() => {
    if (!kit || !guides || !order) return;
    let alive = true;
    (async () => {
      try {
        const up = (image: string) =>
          fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) })
            .then((r) => r.json())
            .then((d) => {
              if (!d.url) throw new Error("upload failed");
              return d.url as string;
            });
        const unique = Array.from(new Set(kit.map((k) => k.src)));
        const [guideUrls, imageUrls] = await Promise.all([Promise.all(guides.map(up)), Promise.all(unique.map(up))]);
        const urlOf = new Map(unique.map((s, i) => [s, imageUrls[i]]));
        const res = await fetch("/api/booth/kit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guide: guideUrls[0],
            guides: guideUrls,
            items: kit.map((k) => ({ sheet: k.sheet, n: k.n, url: urlOf.get(k.src), x: k.x, y: k.y, w: k.w, h: k.h })),
            order,
          }),
        });
        const data = await res.json();
        if (alive) setSent(data.queued ? "queued" : "error");
      } catch {
        if (alive) setSent("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [kit, guides, order]);

  const n = order?.sheets.length ?? 1;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center" style={{ gap: u(1.4), padding: u(2) }}>
      <h2 className="t-h2 text-center">
        Printing your <span className="pop">{n === 1 ? "sheet" : `${n} sheets`}…</span>
      </h2>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ gap: u(2), containerType: "size" }}>
        {(order?.sheets ?? ["pose"]).map((kind, i) => (
          <motion.div
            key={kind}
            className="relative bg-white shadow-[0_14px_40px_rgba(91,63,214,0.22)]"
            style={{
              height: `min(100cqh, calc((100cqw - ${(n - 1) * 32}px) / ${n} * 6.7 / 3.9))`,
              aspectRatio: "3.9 / 6.7",
              borderRadius: 12,
              rotate: n > 1 ? (i - (n - 1) / 2) * 4 : -2,
            }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.12, type: "spring", stiffness: 200, damping: 18 }}
          >
            {guides?.[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={guides[i]} alt={`${getSheet(kind).name} sheet`} className="h-full w-full rounded-[12px]" />
            ) : (
              <div className="h-full w-full animate-pulse rounded-[12px] bg-[var(--lav)]" />
            )}
          </motion.div>
        ))}
      </div>
      <div className={cn("t-body font-semibold", sent === "queued" ? "text-[#15803d]" : sent === "error" ? "text-[var(--pink)]" : "")}>
        {sent === "queued" ? "✓ Sent to the print station" : sent === "error" ? "⚠️ Couldn't reach the print station — please tell staff" : "Sending to the print station…"}
      </div>
      <p className="t-body text-center">Print + cut takes about 2 minutes a sheet. Snap&apos;s on it!</p>
      <button className="btn btn-lg btn-main" onClick={onDone}>
        Got them! 🎉
      </button>
    </div>
  );
}

// ================================================================ done

function Done({
  sticker,
  digitalUrl,
  emailOn,
  autoEmailedTo,
  onFinish,
}: {
  sticker: string | null;
  digitalUrl: string | null;
  emailOn: boolean;
  autoEmailedTo: string | null;
  onFinish: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!digitalUrl) return;
    const page = `${location.origin}/booth/get?u=${encodeURIComponent(digitalUrl)}`;
    QRCode.toDataURL(page, { width: 420, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [digitalUrl]);

  const send = async () => {
    if (!digitalUrl || !email) return;
    setSendState("sending");
    try {
      const r = await fetch("/api/booth/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: digitalUrl, email }),
      });
      const d = await r.json();
      if (!r.ok || !d.sent) throw new Error();
      setSentTo(d.to);
      setSendState("sent");
      setEmail("");
      sounds.success();
    } catch {
      setSendState("error");
    }
  };

  return (
    <div className="relative h-full w-full">
      <Confetti />
      <Split>
        <div className="relative flex items-center justify-center short:hidden landscape:h-full landscape:w-[34%] portrait:w-full portrait:min-h-0 portrait:flex-1">
          {sticker && (
            <motion.img
              src={sticker}
              alt=""
              className="die-cut h-[80%] max-h-full max-w-full object-contain"
              animate={{ rotate: [-5, 5, -5], scale: [1, 1.04, 1] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            />
          )}
        </div>
        <div className="flex flex-col landscape:w-[54%] short:!w-full portrait:items-center portrait:text-center" style={{ gap: u(1.4) }}>
          <h2 className="t-h2">
            Peel, stick, <span className="pop">show off!</span>
          </h2>
          <p className="t-lead short:hidden">Grab your stickers from the tray, and take the pics with you 👇</p>

          <div className="card flex w-full flex-wrap items-center text-left portrait:justify-center" style={{ gap: u(1.6), padding: u(1.4) }}>
            {/* phone QR */}
            <div className="flex items-center" style={{ gap: u(1.2) }}>
              <div className="flex shrink-0 items-center justify-center bg-white" style={{ width: `max(104px, ${u(12)})`, height: `max(104px, ${u(12)})` }}>
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="Scan to save" className="h-full w-full" />
                ) : (
                  <motion.span style={{ fontSize: u(3) }} animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    ✨
                  </motion.span>
                )}
              </div>
              <div style={{ maxWidth: "15em" }}>
                <div className="t-h3">📲 Save to your phone</div>
                <div className="t-body">Scan with your camera, then tap Save or text it to friends.</div>
              </div>
            </div>

            {/* email */}
            {emailOn && (
              <div className="flex min-w-[240px] flex-1 flex-col" style={{ gap: u(0.6) }}>
                <div className="t-h3">📧 Email me the pics</div>
                {autoEmailedTo && <div className="t-body text-[#15803d]">✓ Sent to {autoEmailedTo}</div>}
                {sendState === "sent" ? (
                  <div className="t-body text-[#15803d]">✓ Sent to {sentTo}! Check your inbox.</div>
                ) : (
                  <form
                    className="flex"
                    style={{ gap: u(0.6) }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                  >
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="t-body min-w-0 flex-1 rounded-full border-2 border-[#e4dcff] bg-white px-4 py-2 text-[var(--ink)] outline-none focus:border-[var(--purple)]"
                      style={{ userSelect: "text" }}
                    />
                    <button className="btn btn-main" disabled={!email || !digitalUrl || sendState === "sending"}>
                      {sendState === "sending" ? "Sending…" : "Send"}
                    </button>
                  </form>
                )}
                {sendState === "error" && <div className="t-body text-[var(--pink)]">Couldn&apos;t send. Check the address and try again.</div>}
              </div>
            )}
          </div>

          <button className="btn btn-soft w-fit" onClick={onFinish}>
            Done
          </button>
        </div>
      </Split>
    </div>
  );
}

function Confetti() {
  const colors = ["#7c5cfc", "#ff6b9d", "#feca57", "#45e3ff", "#2ed573", "#ff9f43"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 48 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, width: u(0.8), height: u(1.1), background: colors[i % colors.length] }}
          initial={{ y: -40, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: 360 * (i % 2 ? 1 : -1) }}
          transition={{ duration: 3 + (i % 5) * 0.5, delay: (i % 10) * 0.15, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
