"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { stylePresets } from "@/lib/presets";
import { BOOTH_FREE_MODE, BOOTH_PRICE_LABEL, SHEETS_PER_CASSETTE, STICKERS_PER_SHEET } from "@/lib/booth-config";
import { addStickerBorder, composePrintSheet, downloadDataUrl } from "@/lib/booth-print";
import { sounds } from "@/lib/booth-sounds";
import { cn } from "@/lib/utils";
import Mascot from "./mascot";
import BoothCamera from "./booth-camera";
import OperatorPanel, { type BoothSettings, type GenStats } from "./operator-panel";
import { u } from "./units";

type Step = "attract" | "style" | "camera" | "generating" | "reveal" | "printing" | "done";

const BOOTH_STYLES = stylePresets.filter((p) => p.id !== "custom");
const MAX_TRIES = 3; // generations per guest
const PRINT_SECONDS = 90;

/** Seconds of no touches before a screen gives up and returns to attract. */
const IDLE_SECONDS: Partial<Record<Step, number>> = {
  style: 60,
  camera: 75,
  reveal: 180,
  done: 30,
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
    setOperatorOpen(false);
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
  const generate = useCallback(async (image: string, style: string) => {
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
      try {
        localStorage.setItem("mesticker-booth-gen-ms", String(data.ms));
      } catch {}
      sounds.success();
      setStep("reveal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("reveal");
    }
  }, []);

  // ---- printing: build file, hand it to the printer workflow, upload digital copy
  const startPrint = useCallback(async () => {
    if (!sticker) return;
    setPaid(true);
    setStep("printing");
    try {
      const bordered = await addStickerBorder(sticker);
      const sheet = await composePrintSheet(bordered);
      setPrintFile(sheet);
      downloadDataUrl(sheet, `mesticker-print-${Date.now()}.png`);
      setSettings((s) => {
        if (!s) return s;
        const next = { ...s, sheetsLeft: Math.max(0, s.sheetsLeft - 1), salesToday: s.salesToday + 1 };
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: bordered }),
      })
        .then((r) => r.json())
        .then((d) => d.url && setDigitalUrl(d.url))
        .catch(() => {});
    } catch (e) {
      console.error("print file failed", e);
    }
  }, [sticker]);

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
            {step === "generating" && <Generating photo={photo} />}
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
                onPaid={startPrint}
              />
            )}
            {step === "printing" && <Printing sheet={printFile} onDone={() => setStep("done")} />}
            {step === "done" && <Done sticker={sticker} digitalUrl={digitalUrl} onFinish={reset} />}
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
            {freeMode ? "🎉 Free today!" : `${BOOTH_PRICE_LABEL} · ${STICKERS_PER_SHEET} stickers · 2 min`}
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
            className={cn("card relative flex min-h-0 min-w-0 flex-col overflow-hidden text-left", selected === s.id && "outline outline-[6px] outline-[var(--purple)]")}
            style={{ padding: u(0.6), rotate: i % 2 ? 1.2 : -1.2 }}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 260, damping: 20 }}
            whileTap={{ scale: 0.94, rotate: 0 }}
            onClick={() => onPick(s.id)}
          >
            <div className="relative min-h-0 flex-1 overflow-hidden" style={{ borderRadius: u(1.5), background: CARD_TINTS[i % CARD_TINTS.length] }}>
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
                <img src={s.previewImage} alt={s.name} className="absolute inset-0 h-full w-full object-cover object-[center_25%]" />
              )}
            </div>
            <div className="t-h3 truncate text-center" style={{ padding: `${u(0.6)} ${u(0.4)} ${u(0.2)}` }}>
              {s.id === "random" ? "Surprise me!" : s.name}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ================================================================ generating

function Generating({ photo }: { photo: string | null }) {
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

  return (
    <Split>
      <div className="relative flex items-center justify-center landscape:h-full landscape:w-[40%] portrait:w-full portrait:min-h-0 portrait:flex-1">
        <Mascot className="h-[85%] max-h-full" mood="working" />
      </div>
      <div className="flex flex-col landscape:w-[46%] portrait:w-full portrait:items-center portrait:text-center" style={{ gap: u(2) }}>
        {photo && (
          <motion.div
            className="card relative overflow-hidden short:hidden"
            style={{ width: u(16), rotate: -4 }}
            animate={{ rotate: [-4, 4, -4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="aspect-square w-full object-cover" style={{ borderRadius: u(1.6) }} />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
        <AnimatePresence mode="wait">
          <motion.h2 key={line} className="t-h2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            {LOADING_LINES[line]}
          </motion.h2>
        </AnimatePresence>
        <div className="w-full overflow-hidden rounded-full bg-white shadow-inner" style={{ height: `max(12px, ${u(1.4)})` }}>
          <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--pink)]" animate={{ width: `${progress * 100}%` }} />
        </div>
        <p className="t-body">Hang tight — about 20 seconds.</p>
      </div>
    </Split>
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
  onPaid: () => void;
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
        <h2 className="t-h2">
          Ta-da! <span className="pop">Love it?</span>
        </h2>
        {freeMode ? (
          <button className="btn btn-lg btn-main w-fit" onClick={onPaid}>
            🖨️ Print my stickers
          </button>
        ) : (
          <PayWithQr styleId={styleId} onPaid={onPaid} />
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

function PayWithQr({ styleId, onPaid }: { styleId: string | null; onPaid: () => void }) {
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
          body: JSON.stringify({ styleId }),
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
              onPaid();
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
  }, [styleId, onPaid]);

  if (state === "free") {
    return (
      <button className="btn btn-lg btn-main w-fit" onClick={onPaid}>
        🖨️ Print my stickers
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
          {BOOTH_PRICE_LABEL}
        </div>
        <div className="t-h3">📱 Scan to pay</div>
        <div className="t-body">{STICKERS_PER_SHEET} stickers · Apple Pay, Google Pay, card</div>
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

function Printing({ sheet, onDone }: { sheet: string | null; onDone: () => void }) {
  const [left, setLeft] = useState(PRINT_SECONDS);
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
        <p className="t-lead">Printing, then cutting each one out. About {Math.max(10, Math.ceil(left / 10) * 10)} seconds.</p>
        <div className="w-full overflow-hidden rounded-full bg-white shadow-inner" style={{ height: `max(12px, ${u(1.4)})` }}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--cyan)] to-[var(--green)]"
            animate={{ width: `${((PRINT_SECONDS - left) / PRINT_SECONDS) * 100}%` }}
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

function Done({ sticker, digitalUrl, onFinish }: { sticker: string | null; digitalUrl: string | null; onFinish: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (digitalUrl) QRCode.toDataURL(digitalUrl, { width: 420, margin: 1 }).then(setQr).catch(() => {});
  }, [digitalUrl]);

  return (
    <div className="relative h-full w-full">
      <Confetti />
      <Split>
        <div className="relative flex items-center justify-center landscape:h-full landscape:w-[40%] portrait:w-full portrait:min-h-0 portrait:flex-1">
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
        <div className="flex flex-col landscape:w-[46%] portrait:items-center portrait:text-center" style={{ gap: u(1.8) }}>
          <h2 className="t-hero short:!text-[calc(var(--u)*3.3)]">
            Peel, stick, <span className="pop">show off!</span>
          </h2>
          <p className="t-lead">Grab your sheet from the tray. Thanks for stopping by! 💜</p>
          {qr && (
            <div className="card flex w-fit items-center text-left" style={{ gap: u(1.4), padding: `${u(1)} ${u(1.8)} ${u(1)} ${u(1)}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Scan for digital copy" style={{ width: `max(96px, ${u(11)})`, height: `max(96px, ${u(11)})` }} />
              <div>
                <div className="t-h3">Want the digital copy?</div>
                <div className="t-body">Scan to save it to your phone</div>
              </div>
            </div>
          )}
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
