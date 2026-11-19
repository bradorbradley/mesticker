"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { modelOverride } from "@/lib/model-override";
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
import { LAYOUTS, SHEET_H, SHEET_W } from "@/lib/sheet-layouts";
import BoothReveal from "./booth-reveal";
import { sounds } from "@/lib/booth-sounds";
import { cn } from "@/lib/utils";
import Mascot from "./mascot";
import BoothCamera from "./booth-camera";
import OperatorPanel, { type BoothSettings, type GenStats } from "./operator-panel";
import { u } from "./units";
import LoadingState from "@/components/loading-state";
import { WAIT_GAMES, type WaitGameId } from "./games/wait-games";

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
  const [, setError] = useState<string | null>(null);
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
      body: JSON.stringify({ image, styleId: resolvedStyle, tier: "print", provider: modelOverride() }),
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
      fetch("/api/booth/pose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, provider: modelOverride() }) }).then((r) =>
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
      body: JSON.stringify({ image, styleId: BOOTH_STYLE, provider: modelOverride() }),
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
      setStep("sheets");
      sounds.success();
      uploadDigital(data.generatedImage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("reveal");
    }
  }, []);

  // ---- printing: build the sheets, hand them to the print station, send the digital copy
  /**
   * The print files for these sheets: the sharp main sticker (≤30s wait), the
   * extras (≤60s for stragglers; any that failed print as the main sticker),
   * a numbered guide per sheet and every sticker's placement.
   */
  const buildPrintFiles = useCallback(
    async (sheets: SheetKind[]) => {
      if (!sticker) throw new Error("no sticker");
      const pending = printCopy.current;
      const hq = pending ? await Promise.race([pending, new Promise<null>((r) => setTimeout(() => r(null), 30000))]) : null;
      const main = hq || sticker;
      const needs = new Set<VariantKind>(sheets.flatMap((k) => (k === "best" ? ["pose", "face"] : [k])) as VariantKind[]);
      await Promise.race([Promise.all([...needs].map((k) => variantJobs.current[k])), new Promise((r) => setTimeout(r, 60000))]);
      const v = variantsRef.current;
      const sheetGuides = await Promise.all(sheets.map((k) => buildSheet(k, main, v, false, true)));
      return { main, guides: sheetGuides, kit: await buildKit(sheets, main, v) };
    },
    [sticker]
  );

  /**
   * As soon as a Stripe checkout exists, send the complete order to the print
   * queue (unpaid). The server checks Stripe itself, so the order prints once
   * paid even if this tab never sees the payment (a phone paying in another
   * tab pauses this one).
   */
  const prepared = useRef<{ checkoutId: string; orderId: string } | null>(null);
  const prepareOrder = useCallback(
    async (checkoutId: string) => {
      if (!sticker || !picked.length) return;
      const sheets = picked;
      const orderId = newOrderId();
      prepared.current = { checkoutId, orderId };
      const files = await buildPrintFiles(sheets);
      await sendKit(files.guides, files.kit, { id: orderId, sheets, checkoutId });
    },
    [sticker, picked, buildPrintFiles]
  );

  const startPrint = useCallback(
    async (checkoutId?: string) => {
      if (!sticker || !picked.length) return;
      const sheets = picked;
      setPaid(true);
      // same order id as the one already sent unpaid, so it's one order, now paid
      const orderId = checkoutId && prepared.current?.checkoutId === checkoutId ? prepared.current.orderId : newOrderId();
      setPrintOrder({ id: orderId, sheets, checkoutId: checkoutId ?? null });
      setStep("printing");
      try {
        const { main, guides: sheetGuides, kit: sheetKit } = await buildPrintFiles(sheets);
        setGuides(sheetGuides);
        setKit(sheetKit);
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
    [sticker, picked, emailOn, buildPrintFiles]
  );

  const outOfPaper = settings !== null && settings.sheetsLeft <= 0;
  const freeMode = settings?.freeMode ?? BOOTH_FREE_MODE;

  return (
    <div className="booth fixed inset-0 z-40 flex flex-col overflow-hidden">
      <TopBar
        step={step}
        canJump={(s) =>
          step !== "generating" && step !== "printing" && step !== "done" && step !== s &&
          (s === "camera" || (s === "sheets" && !!sticker))
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
            {step === "generating" && <Generating photo={photo} ready={stickerReady} />}
            {step === "reveal" && (
              <Reveal
                canRetry={tries < MAX_TRIES}
                onRetry={() => (photo ? generate(photo) : setStep("camera"))}
                onRetake={() => {
                  setPhoto(null);
                  setStep("camera");
                }}
              />
            )}
            {step === "sheets" && sticker && (
              <SheetShop
                photo={photo}
                sticker={sticker}
                variants={variants}
                picked={picked}
                freeMode={freeMode}
                sheetsLeft={settings?.sheetsLeft ?? SHEETS_PER_CASSETTE}
                onToggle={(id) => {
                  sounds.tap();
                  setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : SHEET_DESIGNS.map((d) => d.id).filter((x) => x === id || p.includes(x))));
                }}
                canRetry={tries < MAX_TRIES}
                onRetry={() => photo && generate(photo)}
                onRetake={() => {
                  setPhoto(null);
                  setStep("camera");
                }}
                onPaid={startPrint}
                onCheckout={prepareOrder}
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
  { label: "Your stickers", target: "sheets", steps: ["generating", "reveal", "sheets"] },
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

function Generating({ photo, ready }: { photo: string | null; ready: boolean }) {
  // ~10–20 s: the web app's loading animation and countdown, nothing else to compete with it
  return (
    <div className="flex h-full w-full flex-col items-center justify-center" style={{ gap: u(1), padding: u(2) }}>
      <LoadingState photo={photo} className="!py-2" />
      {ready && <span className="t-h3">🎉 Ready!</span>}
    </div>
  );
}

/**
 * Snap's mini-games with a status panel beside them (laptop) or above them
 * (phone). Used while the sheet prints.
 */
function PlayWhileYouWait({ status }: { status: React.ReactNode }) {
  const [game, setGame] = useState<WaitGameId>(() => WAIT_GAMES[Math.floor(Math.random() * WAIT_GAMES.length)].id);
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
      <div className="card flex shrink-0 flex-col landscape:w-[32%] landscape:justify-center short:!w-full" style={{ padding: u(1.2), gap: u(1) }}>
        {status}
        <div className="t-body text-center short:hidden">Play a game while it prints 👇</div>
        {tabs}
      </div>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={game} className="absolute inset-0" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Game />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ================================================================ reveal

function Reveal({ canRetry, onRetry, onRetake }: { canRetry: boolean; onRetry: () => void; onRetake: () => void }) {
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

// ================================================================ sheets + pay

/** "Add 1 more for $8" — what the next sheet costs at the bundle price. */
function bundleHint(count: number) {
  if (count >= 3) return `Best deal: ${priceLabel(bundlePrice(1) * 3 - bundlePrice(3))} off`;
  if (count === 0) return `1 for ${priceLabel(bundlePrice(1))} · 2 for ${priceLabel(bundlePrice(2))} · 3 for ${priceLabel(bundlePrice(3))}`;
  return `Add ${count === 1 ? "another" : "the last one"} for just ${priceLabel(bundlePrice(count + 1) - bundlePrice(count))}`;
}

/** Where each sticker sits on a pack12 sheet, as % of the sheet (for the loading spinners). */
const SLOT_CENTERS = LAYOUTS[SHEET_LAYOUT].map(([x, y, w, h]) => ({ left: ((x + w / 2) / SHEET_W) * 100, top: ((y + h / 2) / SHEET_H) * 100, size: (Math.min(w, h) / SHEET_W) * 100 }));

/**
 * The moment the sticker lands, in two parts on one scrolling screen:
 *   1. the before/after slider, big; dragging it all the way (or tapping
 *      "See my sheets") scrolls down to
 *   2. all three 12-sticker sheets side by side, a spinner on every sticker
 *      that's still being drawn, tap to add/remove, and the order with a big
 *      pay QR (Pose Party is picked from the start, so the QR is already up).
 */
function SheetShop({
  photo,
  sticker,
  variants,
  picked,
  freeMode,
  sheetsLeft,
  canRetry,
  onToggle,
  onRetry,
  onRetake,
  onPaid,
  onCheckout,
}: {
  photo: string | null;
  sticker: string;
  variants: Variants;
  picked: SheetKind[];
  freeMode: boolean;
  sheetsLeft: number;
  canRetry: boolean;
  onToggle: (id: SheetKind) => void;
  onRetry: () => void;
  onRetake: () => void;
  onPaid: (checkoutId?: string) => void;
  onCheckout: (checkoutId: string) => Promise<void>;
}) {
  const [previews, setPreviews] = useState<Partial<Record<SheetKind, string>>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const sheetsRef = useRef<HTMLElement>(null);
  const scrolled = useRef(false);
  const showSheets = useCallback(() => {
    scrolled.current = true;
    sheetsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  // not everyone drags the slider: move on by itself after a while
  useEffect(() => {
    const t = setTimeout(() => !scrolled.current && showSheets(), 12000);
    return () => clearTimeout(t);
  }, [showSheets]);

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

  const count = picked.length;
  const tooMany = count > sheetsLeft;

  return (
    <div ref={scroller} className="h-full w-full overflow-y-auto overflow-x-hidden scroll-smooth">
      {/* 1 — the reveal */}
      <section className="flex h-full flex-col items-center" style={{ gap: u(0.8), padding: `${u(0.4)} ${u(2)} ${u(1)}` }}>
        <h2 className="t-h2 text-center short:hidden">
          Ta-da! <span className="pop">That&apos;s you.</span>
        </h2>
        <div className="relative min-h-0 w-full flex-1">
          <BoothReveal photo={photo} sticker={sticker} onRevealed={() => setTimeout(showSheets, 700)} />
        </div>
        <div className="t-body text-center">👈 Drag the slider to see the whole sticker</div>
        <div className="flex flex-wrap justify-center" style={{ gap: u(0.8) }}>
          <button className="btn btn-lg btn-main" onClick={showSheets}>
            See my sticker sheets ↓
          </button>
          {canRetry && (
            <button className="btn btn-soft" onClick={onRetry}>
              🔄 Redo
            </button>
          )}
          <button className="btn btn-soft" onClick={onRetake}>
            📸 New photo
          </button>
        </div>
      </section>

      {/* 2 — the sheets + the order */}
      <section
        ref={sheetsRef}
        className="flex min-h-full flex-col landscape:flex-row short:!flex-col"
        style={{ gap: u(1.4), padding: `${u(1.2)} ${u(2)} ${u(1.6)}` }}
      >
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: u(0.8) }}>
          <h2 className="t-h2">
            Pick your <span className="pop">sheets</span>
          </h2>
          <div className="t-body">12 stickers on every sheet. Tap to add or remove.</div>
          <div className="grid grid-cols-3" style={{ gap: u(1.2) }}>
            {SHEET_DESIGNS.map((d) => {
              const on = picked.includes(d.id);
              const srcs = sheetSources(d.id, sticker, variants, true);
              const loading = srcs.flatMap((src, i) => (src ? [] : [i]));
              return (
                <motion.button
                  key={d.id}
                  onClick={() => onToggle(d.id)}
                  className={cn(
                    "relative flex flex-col items-center rounded-3xl border-[5px] bg-white/80 text-center transition-colors",
                    on ? "border-[var(--purple)] bg-white shadow-[0_12px_32px_rgba(91,63,214,0.25)]" : "border-transparent opacity-80"
                  )}
                  style={{ padding: u(0.8), gap: u(0.5) }}
                  whileTap={{ scale: 0.97 }}
                  aria-pressed={on}
                >
                  <span
                    className={cn("absolute right-2 top-2 z-10 rounded-full font-bold shadow", on ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--ink)]")}
                    style={{ padding: `${u(0.2)} ${u(0.8)}`, fontSize: `max(12px, ${u(1.2)})` }}
                  >
                    {on ? "✓ Added" : "+ Add"}
                  </span>
                  <div className="relative w-full bg-white shadow-sm" style={{ aspectRatio: "3.9 / 6.7", borderRadius: 10 }}>
                    {previews[d.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[d.id]} alt={`${d.name} sheet`} className="h-full w-full rounded-[10px]" />
                    ) : (
                      <div className="h-full w-full rounded-[10px] bg-[var(--lav)]" />
                    )}
                    {/* a spinner on every sticker still being drawn */}
                    {loading.map((i) => (
                      <span
                        key={i}
                        className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                        style={{ left: `${SLOT_CENTERS[i].left}%`, top: `${SLOT_CENTERS[i].top}%`, width: `${SLOT_CENTERS[i].size * 0.5}%`, aspectRatio: "1" }}
                      >
                        <motion.span
                          className="block h-full w-full rounded-full border-[3px] border-[var(--purple)] border-t-transparent"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                        />
                      </span>
                    ))}
                  </div>
                  <div className="t-h3" style={{ fontSize: `max(13px, ${u(1.6)})` }}>
                    {d.emoji} {d.name}
                  </div>
                  <div className="t-body short:hidden" style={{ fontSize: `max(11px, ${u(1.05)})` }}>
                    {loading.length ? `✨ drawing ${loading.length} more…` : d.blurb}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* the order: what's in it, the price, the QR */}
        <div className="card flex shrink-0 flex-col landscape:w-[34%] landscape:self-center short:!w-full" style={{ gap: u(0.9), padding: u(1.4) }}>
          <div className="t-h3">Your order</div>
          {count ? (
            <div className="flex flex-wrap" style={{ gap: u(0.5) }}>
              {picked.map((id) => (
                <span key={id} className="chip bg-[var(--lav)] text-[var(--ink)]">
                  {getSheet(id).emoji} {getSheet(id).name}
                </span>
              ))}
            </div>
          ) : (
            <div className="t-body">Tap a sheet to add it</div>
          )}
          <div className="t-body">
            <b>
              {count} sheet{count === 1 ? "" : "s"} · {count * STICKERS_PER_SHEET} stickers
            </b>{" "}
            · <span className="text-[#15803d]">{bundleHint(count)}</span>
          </div>
          {tooMany && <div className="t-body text-[var(--pink)]">Only {sheetsLeft} sheet{sheetsLeft === 1 ? "" : "s"} of paper left — pick fewer</div>}
          {count > 0 &&
            !tooMany &&
            (freeMode ? (
              <button className="btn btn-lg btn-main" onClick={() => onPaid()}>
                🖨️ Print {count === 1 ? "my sheet" : `my ${count} sheets`}
              </button>
            ) : (
              <PayWithQr key={picked.join("+")} sheets={picked} onPaid={onPaid} onCheckout={onCheckout} />
            ))}
        </div>
      </section>
    </div>
  );
}

function PayWithQr({
  sheets,
  onPaid,
  onCheckout,
}: {
  sheets: SheetKind[];
  onPaid: (checkoutId?: string) => void;
  onCheckout: (checkoutId: string) => Promise<void>;
}) {
  const [qr, setQr] = useState<string | null>(null);
  // paying on this same phone pauses this tab: only offer it once the order is safely sent
  const [sentAhead, setSentAhead] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
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
        setPayUrl(data.url);
        setState("waiting");
        onCheckout(data.id)
          .catch((e) => console.error("order pre-send failed", e))
          .finally(() => alive && setSentAhead(true));
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
  }, [sheets, onPaid, onCheckout]);

  if (state === "free") {
    return (
      <button className="btn btn-lg btn-main w-fit" onClick={() => onPaid()}>
        🖨️ Print my sheets
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between" style={{ gap: u(1) }}>
      <div className="flex min-w-0 flex-col" style={{ gap: u(0.3) }}>
        <div className="font-fun font-bold" style={{ fontSize: u(3.6), lineHeight: 1 }}>
          {priceLabel(price)}
        </div>
        <div className="t-h3">📱 Scan to pay</div>
        <div className="t-body">Apple Pay, Google Pay, card</div>
        {payUrl &&
          (sentAhead ? (
            // already on your phone? pay in a new tab: the order is already at the print station
            <a className="btn btn-soft mt-1 w-fit" href={payUrl} target="_blank" rel="noopener noreferrer">
              💳 Pay here
            </a>
          ) : (
            <span className="t-body mt-1 opacity-70">Getting your sheets ready…</span>
          ))}
        {state === "waiting" && (
          <motion.div className="t-body text-[#15803d]" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
            ● Printing starts automatically
          </motion.div>
        )}
      </div>
      <div className="flex aspect-square shrink-0 items-center justify-center overflow-hidden bg-white" style={{ width: `clamp(140px, ${u(17)}, 50%)` }}>
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

/** Upload each sticker once plus the guides, and put the order on the print queue. */
async function sendKit(guides: string[], kit: KitItem[], order: PrintOrder): Promise<boolean> {
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
  return !!data.queued;
}

/** What /api/booth/order-status returns. */
type OrderProgress = {
  status: "queued" | "printing" | "done" | "failed";
  stage: "preparing" | "printing" | null;
  stageAt: string | null;
  verified: boolean;
  ahead: number;
  sheets: number;
  serverTime: string;
};
const SHEET_SECONDS = 130; // print + cut, per sheet

/** Turn the order's live status into a bar position (0–1) and a line of text. */
function printPhase(sent: "sending" | "queued" | "error", p: OrderProgress | null, clockSkew: number): { pct: number; label: string; detail?: string } {
  if (sent === "error") return { pct: 0.02, label: "Couldn't reach the printer", detail: "Please tell staff: your payment went through." };
  if (sent === "sending" || !p) return { pct: 0.04, label: "Sending to the printer…" };
  const since = (iso: string | null) => (iso ? Math.max(0, (Date.now() + clockSkew - Date.parse(iso)) / 1000) : 0);
  if (p.status === "failed") return { pct: 0.5, label: "The printer hit a snag", detail: "Staff have been told and will sort it out." };
  if (p.status === "done") return { pct: 1, label: "Done! Grab your stickers 🎉" };
  if (p.status === "queued") {
    if (!p.verified) return { pct: 0.08, label: "Confirming your payment…" };
    return p.ahead > 0
      ? { pct: 0.12, label: `In line: ${p.ahead} ${p.ahead === 1 ? "sheet" : "orders"} ahead of you`, detail: `About ${Math.ceil((p.ahead * SHEET_SECONDS) / 60)} min` }
      : { pct: 0.16, label: "You're up next!" };
  }
  if (p.stage !== "printing") return { pct: Math.min(0.3, 0.2 + since(p.stageAt) / 300), label: "Laying out your sheet…" };
  const total = SHEET_SECONDS * p.sheets;
  const t = since(p.stageAt);
  const left = Math.max(5, Math.round(total - t));
  return {
    pct: Math.min(0.97, 0.3 + 0.67 * (t / total)),
    label: t < total * 0.55 ? "Printing your stickers…" : "Cutting them out…",
    detail: `About ${left >= 60 ? `${Math.ceil(left / 60)} min` : `${left} s`} left`,
  };
}

function PrintKit({ guides, kit, order, onDone }: { guides: string[] | null; kit: KitItem[] | null; order: PrintOrder | null; onDone: () => void }) {
  const [sent, setSent] = useState<"sending" | "queued" | "error">("sending");
  const [progress, setProgress] = useState<OrderProgress | null>(null);
  const [skew, setSkew] = useState(0);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!kit || !guides || !order) return;
    let alive = true;
    (async () => {
      try {
        const queued = await sendKit(guides, kit, order);
        if (alive) setSent(queued ? "queued" : "error");
      } catch {
        if (alive) setSent("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [kit, guides, order]);

  // live status from the print station, every 2 s until it's done
  useEffect(() => {
    if (sent !== "queued" || !order) return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/booth/order-status?id=${encodeURIComponent(order.id)}`, { cache: "no-store" });
        if (!r.ok) return;
        const p = (await r.json()) as OrderProgress;
        if (!alive) return;
        setSkew(Date.parse(p.serverTime) - Date.now());
        setProgress((prev) => {
          if (p.status === "done" && prev?.status !== "done") sounds.success();
          return p;
        });
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    const t = setInterval(() => tick((n) => n + 1), 1000); // smooth countdown between polls
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(t);
    };
  }, [sent, order]);

  const phase = printPhase(sent, progress, skew);
  const done = progress?.status === "done";
  const n = order?.sheets.length ?? 1;

  const status = (
    <div className="flex flex-col items-center text-center" style={{ gap: u(0.8) }}>
      <div className="flex items-center" style={{ gap: u(1) }}>
        {guides?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={guides[0]} alt="Your sheet" className="shrink-0 rounded-md bg-white shadow short:hidden" style={{ height: `max(72px, ${u(11)})`, aspectRatio: "3.9 / 6.7" }} />
        )}
        <div className="flex flex-col text-left" style={{ gap: 2 }}>
          <div className="t-h3">{n === 1 ? "Your sheet" : `Your ${n} sheets`}</div>
          <div className={cn("t-body font-bold", done ? "text-[#15803d]" : sent === "error" || progress?.status === "failed" ? "text-[var(--pink)]" : "text-[var(--ink)]")}>{phase.label}</div>
          {phase.detail && <div className="t-body">{phase.detail}</div>}
        </div>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-[var(--lav)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(phase.pct * 100)}>
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", done ? "from-[var(--cyan)] to-[var(--green)]" : "from-[var(--purple)] to-[var(--pink)]")}
          animate={{ width: `${phase.pct * 100}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <div className="t-body flex w-full justify-between opacity-70" style={{ fontSize: `max(11px, ${u(1)})` }}>
        <span>Sent</span>
        <span>In line</span>
        <span>Printing</span>
        <span>Cut ✂️</span>
      </div>
      {/* always there, so staff can move on if the station is offline; loud once it's done */}
      <button className={done ? "btn btn-lg btn-main" : "btn btn-soft"} onClick={onDone}>
        {done ? "Got them! 🎉" : "I've got my stickers"}
      </button>
    </div>
  );

  return <PlayWhileYouWait status={status} />;
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
