"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { stylePresets } from "@/lib/presets";
import { BOOTH_FREE_MODE, BOOTH_FROM_LABEL, BOOTH_PRODUCTS, DEFAULT_PRODUCT_ID, SHEETS_PER_CASSETTE, getProduct, priceLabel, type BoothProduct } from "@/lib/booth-config";
import { addStickerBorder, composePrintSheet, downloadDataUrl } from "@/lib/booth-print";
import { sounds } from "@/lib/booth-sounds";
import { cn } from "@/lib/utils";
import Mascot from "./mascot";
import BoothCamera from "./booth-camera";
import OperatorPanel, { type BoothSettings, type GenStats } from "./operator-panel";
import { u } from "./units";
import { WAIT_GAMES, ReadyTakeover, type WaitGameId } from "./games/wait-games";

type Step = "attract" | "style" | "camera" | "generating" | "reveal" | "printing" | "done";

const BOOTH_STYLES = stylePresets.filter((p) => p.id !== "custom");
const MAX_TRIES = 3; // generations per guest
const PRINT_SECONDS = 90;

/** Seconds of no touches before a screen gives up and returns to attract. */
const IDLE_SECONDS: Partial<Record<Step, number>> = {
  style: 60,
  camera: 75,
  reveal: 180,
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

const LOADING_LINES = [
  "Developing your photo…",
  "Mixing the perfect colors…",
  "Drawing the outline…",
  "Adding extra sparkle…",
  "Almost peel-ready…",
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
  const [styleId, setStyleId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [sticker, setSticker] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastGen, setLastGen] = useState<GenStats | null>(null);
  const [printFile, setPrintFile] = useState<string | null>(null);
  const [digitalUrl, setDigitalUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<BoothSettings | null>(null);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  // Sticker is done but the guest is mid-game: the "It's ready!" takeover plays first.
  const [stickerReady, setStickerReady] = useState(false);
  const [productId, setProductId] = useState<BoothProduct["id"]>(DEFAULT_PRODUCT_ID);
  const [emailOn, setEmailOn] = useState(false);
  const [autoEmailedTo, setAutoEmailedTo] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/booth/send")
      .then((r) => r.json())
      .then((d) => setEmailOn(!!d.email))
      .catch(() => {});
  }, []);
  const showReveal = useCallback(() => setStep("reveal"), []);

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
    setStyleId(null);
    setPhoto(null);
    setSticker(null);
    setTries(0);
    setError(null);
    setPrintFile(null);
    setDigitalUrl(null);
    setPaid(false);
    setStickerReady(false);
    setProductId(DEFAULT_PRODUCT_ID);
    setAutoEmailedTo(null);
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

  const generate = useCallback(async (image: string, style: string) => {
    printCopy.current = null;
    setStickerReady(false);
    setStep("generating");
    setError(null);
    setSticker(null);
    setPrintFile(null);
    setTries((t) => t + 1);
    try {
      const res = await fetch("/api/booth/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, styleId: style }),
      });
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

  // ---- printing: build file(s), hand them to the printer workflow, send the digital copy
  const startPrint = useCallback(
    async (checkoutId?: string) => {
      if (!sticker) return;
      const product = getProduct(productId) ?? BOOTH_PRODUCTS[0];
      setPaid(true);
      setStep("printing");
      try {
        // Prefer the sharper print copy; don't hold the printer more than 30s for it.
        const pending = printCopy.current;
        const hq = pending ? await Promise.race([pending, new Promise<null>((r) => setTimeout(() => r(null), 30000))]) : null;
        const bordered = await addStickerBorder(hq || sticker);
        const sheet = await composePrintSheet(bordered, product.layout);
        setPrintFile(sheet);
        const stamp = Date.now();
        for (let i = 1; i <= product.sheets; i++) {
          downloadDataUrl(sheet, `mesticker-print-${stamp}${product.sheets > 1 ? `-${i}of${product.sheets}` : ""}.png`);
        }
        setSettings((s) => {
          if (!s) return s;
          const next = { ...s, sheetsLeft: Math.max(0, s.sheetsLeft - product.sheets), salesToday: s.salesToday + 1 };
          try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
        // the sharp copy replaces the preview for the phone QR, then email it to whoever paid
        const url = await uploadDigital(hq || sticker);
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
    [sticker, productId, emailOn]
  );

  const outOfPaper = settings !== null && settings.sheetsLeft <= 0;
  const freeMode = settings?.freeMode ?? BOOTH_FREE_MODE;

  return (
    <div className="booth fixed inset-0 z-40 flex flex-col overflow-hidden">
      <TopBar
        step={step}
        canJump={(s) =>
          step !== "generating" && step !== "printing" && step !== "done" && step !== s &&
          (s === "style" || (s === "camera" && !!styleId) || (s === "reveal" && !!sticker))
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
                  setStep("style");
                }}
              />
            )}
            {step === "style" && (
              <StylePicker
                selected={styleId}
                onPick={(id) => {
                  sounds.tap();
                  setStyleId(id);
                  if (photo) generate(photo, id);
                  else setTimeout(() => setStep("camera"), 250);
                }}
              />
            )}
            {step === "camera" && (
              <BoothCamera
                onBack={() => setStep("style")}
                onCapture={(p) => {
                  setPhoto(p);
                  generate(p, styleId || "random");
                }}
              />
            )}
            {step === "generating" && <Generating photo={photo} ready={stickerReady} onReveal={showReveal} />}
            {step === "reveal" && (
              <Reveal
                sticker={sticker}
                error={error}
                freeMode={freeMode}
                canRetry={tries < MAX_TRIES}
                styleId={styleId}
                onRetry={() => (photo && styleId ? generate(photo, styleId) : setStep("camera"))}
                onOtherStyle={() => setStep("style")}
                onRetake={() => {
                  setPhoto(null);
                  setStep("camera");
                }}
                product={getProduct(productId) ?? BOOTH_PRODUCTS[0]}
                sheetsLeft={settings?.sheetsLeft ?? SHEETS_PER_CASSETTE}
                onProduct={(id) => {
                  sounds.tap();
                  setProductId(id);
                }}
                onPaid={startPrint}
              />
            )}
            {step === "printing" && <Printing sheet={printFile} sheets={(getProduct(productId) ?? BOOTH_PRODUCTS[0]).sheets} onDone={() => setStep("done")} />}
            {step === "done" && <Done sticker={sticker} digitalUrl={digitalUrl} emailOn={emailOn} autoEmailedTo={autoEmailedTo} onFinish={reset} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {operatorOpen && settings && (
        <OperatorPanel
          settings={settings}
          update={updateSettings}
          lastGen={lastGen}
          canReprint={!!printFile}
          canMarkPaid={step === "reveal" && !!sticker && !paid}
          onReprint={() => printFile && downloadDataUrl(printFile, `mesticker-print-${Date.now()}.png`)}
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
  { label: "Style", target: "style", steps: ["style"] },
  { label: "Pose", target: "camera", steps: ["camera"] },
  { label: "Pay", target: "reveal", steps: ["generating", "reveal"] },
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

// ================================================================ style picker

const CARD_TINTS = ["#ffe4ef", "#e6f9ff", "#fff3d1", "#efe9ff", "#dcfce7", "#ffe9d6"];

function StylePicker({ selected, onPick }: { selected: string | null; onPick: (id: string) => void }) {
  return (
    <div className="flex h-full flex-col" style={{ padding: `0 ${u(3)} ${u(2.5)}`, gap: u(1.6) }}>
      <h2 className="t-h2 shrink-0">
        Pick your <span className="pop">look!</span>
      </h2>
      <div className="grid min-h-0 flex-1 landscape:grid-cols-3 landscape:grid-rows-2 short:!grid-cols-6 short:!grid-rows-1 portrait:grid-cols-2 portrait:grid-rows-3" style={{ gap: u(1.6) }}>
        {BOOTH_STYLES.map((s, i) => (
          <motion.button
            key={s.id}
            className={cn("card relative block min-h-0 min-w-0 overflow-hidden text-left", selected === s.id && "outline outline-[6px] outline-[var(--purple)]")}
            style={{ padding: u(0.6), rotate: i % 2 ? 1.2 : -1.2 }}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 260, damping: 20 }}
            whileTap={{ scale: 0.94, rotate: 0 }}
            onClick={() => onPick(s.id)}
          >
            {/* inner wrapper: some older browsers won't lay out a <button> as a flex box */}
            <div className="flex h-full w-full flex-col">
            <div className="relative min-h-0 w-full flex-1 overflow-hidden" style={{ borderRadius: u(1.5), background: CARD_TINTS[i % CARD_TINTS.length] }}>
              {s.id === "random" ? (
                <div className="flex h-full items-center justify-center">
                  <motion.span
                    className="leading-none"
                    style={{ fontSize: u(5) }}
                    animate={{ rotate: [0, 12, -12, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  >
                    🎲
                  </motion.span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.previewImage} alt={s.name} className="absolute left-0 top-0 h-full w-full object-cover object-[center_25%]" />
              )}
            </div>
            <div className="t-h3 w-full truncate text-center" style={{ padding: `${u(0.6)} ${u(0.4)} ${u(0.2)}` }}>
              {s.id === "random" ? "Surprise me!" : s.name}
            </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
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

  return (
    <div className="relative flex h-full w-full flex-col" style={{ padding: `0 ${u(3)} ${u(1)}`, gap: u(0.6) }}>
      {/* sticker progress + game picker */}
      <div className="card flex shrink-0 flex-wrap items-center" style={{ gap: `${u(0.6)} ${u(1.2)}`, padding: `${u(0.5)} ${u(1)}` }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="shrink-0 object-cover" style={{ width: `max(36px, ${u(4)})`, height: `max(36px, ${u(4)})`, borderRadius: u(1) }} />
        )}
        <div className="flex min-w-[160px] flex-1 items-center" style={{ gap: u(1) }}>
          <span className="t-body shrink-0 font-bold text-[var(--ink)]">{ready ? "🎉 Ready!" : LOADING_LINES[line]}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--lav)]">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--pink)]" animate={{ width: `${(ready ? 1 : progress) * 100}%` }} />
          </div>
        </div>
        <nav className="flex flex-wrap" style={{ gap: u(0.5) }}>
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

// ================================================================ reveal + pay

function Reveal({
  sticker,
  error,
  freeMode,
  canRetry,
  styleId,
  onRetry,
  onOtherStyle,
  onRetake,
  product,
  sheetsLeft,
  onProduct,
  onPaid,
}: {
  sticker: string | null;
  error: string | null;
  freeMode: boolean;
  canRetry: boolean;
  styleId: string | null;
  onRetry: () => void;
  onOtherStyle: () => void;
  onRetake: () => void;
  product: BoothProduct;
  sheetsLeft: number;
  onProduct: (id: BoothProduct["id"]) => void;
  onPaid: (checkoutId?: string) => void;
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
    <Split>
      <div className="relative flex items-center justify-center landscape:h-full landscape:w-[46%] portrait:w-full portrait:min-h-0 portrait:flex-1">
        <motion.div
          className="absolute aspect-square h-[88%] max-h-[44vw] portrait:max-h-[86vw] rounded-full bg-gradient-to-br from-[#ffd6e7] via-[#efe9ff] to-[#d9f7ff]"
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: 360 }}
          transition={{ scale: { type: "spring", stiffness: 120, damping: 14 }, rotate: { duration: 40, repeat: Infinity, ease: "linear" } }}
        />
        <motion.img
          src={sticker}
          alt="Your sticker"
          className="die-cut relative h-[84%] max-h-full max-w-full object-contain"
          initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: -3, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 12, delay: 0.1 }}
        />
      </div>

      <div className="flex flex-col landscape:w-[44%] portrait:items-center portrait:text-center" style={{ gap: u(1.8) }}>
        <h2 className="t-h2 short:hidden">
          Ta-da! <span className="pop">Love it?</span>
        </h2>
        <ProductMenu selected={product.id} sheetsLeft={sheetsLeft} freeMode={freeMode} onPick={onProduct} />
        {freeMode ? (
          <button className="btn btn-lg btn-main w-fit" onClick={() => onPaid()}>
            🖨️ Print my {product.name}
          </button>
        ) : (
          <PayWithQr key={product.id} styleId={styleId} product={product} onPaid={onPaid} />
        )}
        <div className="flex flex-wrap portrait:justify-center" style={{ gap: u(1) }}>
          {canRetry && (
            <>
              <button className="btn btn-soft" onClick={onRetry}>
                🔄 Redo
              </button>
              <button className="btn btn-soft" onClick={onOtherStyle}>
                🎨 New style
              </button>
            </>
          )}
          <button className="btn btn-soft" onClick={onRetake}>
            📸 New photo
          </button>
        </div>
      </div>
    </Split>
  );
}

/** The menu: what the PixCut S1 can make from a sheet. */
function ProductMenu({
  selected,
  sheetsLeft,
  freeMode,
  onPick,
}: {
  selected: BoothProduct["id"];
  sheetsLeft: number;
  freeMode: boolean;
  onPick: (id: BoothProduct["id"]) => void;
}) {
  return (
    <div className="grid w-full grid-cols-3" style={{ gap: u(1) }}>
      {BOOTH_PRODUCTS.map((p) => {
        const soldOut = p.sheets > sheetsLeft;
        const on = p.id === selected;
        return (
          <motion.button
            key={p.id}
            disabled={soldOut}
            className={cn("card relative block text-center disabled:opacity-40", on && "outline outline-[5px] outline-[var(--purple)]")}
            style={{ padding: `${u(1)} ${u(0.6)} ${u(0.8)}` }}
            animate={{ scale: on ? 1.04 : 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPick(p.id)}
          >
            {p.tag && (
              <span className="chip absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-[var(--yellow)] text-[var(--ink)]" style={{ fontSize: `max(11px, ${u(1)})` }}>
                {p.tag}
              </span>
            )}
            <div className="short:hidden" style={{ fontSize: u(2.6), lineHeight: 1.1 }}>{p.emoji}</div>
            <div className="t-h3" style={{ fontSize: `max(14px, ${u(1.6)})` }}>
              {p.name}
            </div>
            <div className="t-body short:hidden" style={{ fontSize: `max(11px, ${u(1.05)})` }}>
              {soldOut ? "Not enough paper" : p.blurb}
            </div>
            {!freeMode && (
              <div className="font-fun font-bold text-[var(--purple)]" style={{ fontSize: `max(16px, ${u(2.2)})` }}>
                {priceLabel(p.priceCents)}
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function PayWithQr({ styleId, product, onPaid }: { styleId: string | null; product: BoothProduct; onPaid: (checkoutId?: string) => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "waiting" | "free" | "error">("loading");
  const paidRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        const res = await fetch("/api/booth/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ styleId, productId: product.id }),
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
    })();
    return () => {
      alive = false;
      if (poll) clearInterval(poll);
    };
  }, [styleId, product.id, onPaid]);

  if (state === "free") {
    return (
      <button className="btn btn-lg btn-main w-fit" onClick={() => onPaid()}>
        🖨️ Print my {product.name}
      </button>
    );
  }

  return (
    <div className="card flex w-fit items-center" style={{ gap: u(1.8), padding: `${u(1.2)} ${u(2)} ${u(1.2)} ${u(1.2)}` }}>
      <div className="flex shrink-0 items-center justify-center overflow-hidden bg-white" style={{ width: `max(120px, ${u(15)})`, height: `max(120px, ${u(15)})` }}>
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
      <div className="flex flex-col text-left" style={{ gap: u(0.5) }}>
        <div className="font-fun font-bold" style={{ fontSize: u(4.2), lineHeight: 1 }}>
          {priceLabel(product.priceCents)}
        </div>
        <div className="t-h3">📱 Scan to pay</div>
        <div className="t-body">{product.name} · Apple Pay, Google Pay, card</div>
        {state === "waiting" && (
          <motion.div className="t-body text-[#15803d]" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
            ● Printing starts automatically
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ================================================================ printing

function Printing({ sheet, sheets, onDone }: { sheet: string | null; sheets: number; onDone: () => void }) {
  const total = PRINT_SECONDS * sheets;
  const [left, setLeft] = useState(total);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);

  return (
    <Split>
      <div className="flex flex-col landscape:w-[46%] portrait:items-center portrait:text-center" style={{ gap: u(1.8) }}>
        <h2 className="t-h2">
          Printing your <span className="pop">stickers…</span>
        </h2>
        <p className="t-lead">
          {sheets > 1 ? `${sheets} sheets: printing` : "Printing"}, then cutting each one out. About {Math.max(10, Math.ceil(left / 10) * 10)} seconds.
        </p>
        <div className="w-full overflow-hidden rounded-full bg-white shadow-inner" style={{ height: `max(12px, ${u(1.4)})` }}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--cyan)] to-[var(--green)]"
            animate={{ width: `${((total - left) / total) * 100}%` }}
          />
        </div>
        <button className="btn btn-lg btn-main w-fit" onClick={onDone}>
          Got them! 🎉
        </button>
      </div>

      <div className="relative flex items-end justify-center landscape:h-full landscape:w-[40%] portrait:w-full portrait:min-h-0 portrait:flex-1" style={{ gap: u(1) }}>
        <Mascot className="h-[70%] max-h-full" mood="excited" />
        <motion.div
          className="card shrink-0 overflow-hidden"
          style={{ width: u(13), padding: u(0.5), marginBottom: u(3) }}
          initial={{ y: 60, opacity: 0, rotate: 0 }}
          animate={{ y: 0, opacity: 1, rotate: 6 }}
          transition={{ duration: 1.2, delay: 0.4, type: "spring" }}
        >
          {sheet ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sheet} alt="Your sticker sheet" className="w-full" />
          ) : (
            <div className="aspect-[3.9/6.7] w-full bg-[var(--lav)]" />
          )}
        </motion.div>
      </div>
    </Split>
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
