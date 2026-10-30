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
  "Adding a little extra charm…",
  "Almost peel-ready…",
];

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
    <div className="booth grain fixed inset-0 z-40 flex flex-col overflow-hidden">
      <TopBar step={step} onSecret={() => setOperatorOpen(true)} onHome={step !== "attract" && step !== "printing" ? reset : undefined} />

      <main className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
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

const STEP_LABELS: { label: string; steps: Step[] }[] = [
  { label: "Style", steps: ["style"] },
  { label: "Pose", steps: ["camera"] },
  { label: "Pay", steps: ["generating", "reveal"] },
  { label: "Print", steps: ["printing", "done"] },
];

function TopBar({ step, onSecret, onHome }: { step: Step; onSecret: () => void; onHome?: () => void }) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = STEP_LABELS.findIndex((s) => s.steps.includes(step));
  return (
    <header className="flex h-[88px] shrink-0 items-center justify-between px-10">
      <div
        className="display cursor-default text-[34px] font-semibold"
        onPointerDown={() => (hold.current = setTimeout(onSecret, 2000))}
        onPointerUp={() => hold.current && clearTimeout(hold.current)}
        onPointerLeave={() => hold.current && clearTimeout(hold.current)}
        onContextMenu={(e) => e.preventDefault()}
      >
        Me<em className="italic text-[var(--coral)]">Sticker</em>
      </div>

      {current >= 0 && (
        <ol className="flex items-center gap-2">
          {STEP_LABELS.map((s, i) => (
            <li
              key={s.label}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold transition-colors",
                i === current ? "bg-[var(--ink)] text-white" : i < current ? "bg-[var(--sage-soft)] text-[var(--sage)]" : "text-[var(--ink-3)]"
              )}
            >
              <span className="text-base">{i < current ? "✓" : i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>
      )}

      <div className="w-[160px] text-right">
        {onHome && (
          <button className="btn-ghost px-5 py-2 text-lg" onClick={onHome}>
            Start over
          </button>
        )}
      </div>
    </header>
  );
}

// ================================================================ attract

function Attract({ onStart, outOfPaper, freeMode }: { onStart: () => void; outOfPaper: boolean; freeMode: boolean }) {
  const examples = BOOTH_STYLES.filter((s) => s.id !== "random");
  return (
    <button
      className="flex h-full w-full items-center gap-8 px-16 pb-10 text-left disabled:cursor-not-allowed"
      onClick={onStart}
      disabled={outOfPaper}
    >
      <div className="flex w-[52%] flex-col gap-7">
        <motion.span
          className="w-fit rounded-full bg-[var(--mustard-soft)] px-5 py-2 text-xl font-semibold"
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          {freeMode ? "✨ Free today!" : `${BOOTH_PRICE_LABEL} · ${STICKERS_PER_SHEET} stickers · ready in 2 min`}
        </motion.span>
        <h1 className="display text-[clamp(56px,6.4vw,112px)] leading-[0.95]">
          Turn yourself into a <em className="italic text-[var(--coral)]">sticker.</em>
        </h1>
        <p className="max-w-[34ch] text-[clamp(20px,1.8vw,28px)] leading-snug text-[var(--ink-2)]">
          Pick a cartoon style, snap a photo, and peel off real stickers printed right here.
        </p>

        {outOfPaper ? (
          <div className="w-fit rounded-full bg-[var(--ground)] px-10 py-6 text-3xl font-semibold text-[var(--ink-2)]">
            🧻 Out of stickers — back in a minute!
          </div>
        ) : (
          <motion.div
            className="btn-primary w-fit px-14 py-7 text-[clamp(26px,2.4vw,38px)]"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            Tap to start ✨
          </motion.div>
        )}

        <ol className="mt-2 flex gap-8 text-xl text-[var(--ink-2)]">
          {["Pick a style", "Strike a pose", "Pay by phone", "Peel & stick"].map((t, i) => (
            <li key={t} className="flex items-center gap-2">
              <span className="display flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-semibold text-[var(--ink)] shadow">
                {i + 1}
              </span>
              {t}
            </li>
          ))}
        </ol>
      </div>

      <div className="relative flex h-full flex-1 items-center justify-center">
        {examples.slice(0, 4).map((s, i) => {
          const pos = [
            { left: "0%", top: "8%", rotate: -10 },
            { right: "0%", top: "4%", rotate: 8 },
            { left: "4%", bottom: "10%", rotate: 7 },
            { right: "2%", bottom: "14%", rotate: -6 },
          ][i];
          return (
            <motion.div
              key={s.id}
              className="sticker-card absolute w-[26%] overflow-hidden p-2"
              style={{ ...pos, rotate: pos.rotate }}
              animate={{ y: [0, i % 2 ? 12 : -12, 0] }}
              transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.previewImage} alt={s.name} className="aspect-square w-full rounded-[20px] object-cover" />
              <div className="py-1 text-center text-lg font-semibold">{s.name}</div>
            </motion.div>
          );
        })}
        <Mascot className="relative z-10 h-[72%]" mood="idle" />
      </div>
    </button>
  );
}

// ================================================================ style picker

function StylePicker({ selected, onPick }: { selected: string | null; onPick: (id: string) => void }) {
  return (
    <div className="flex h-full flex-col px-12 pb-10">
      <h2 className="display mb-6 text-[clamp(40px,4.4vw,72px)] leading-none">
        Pick your <em className="italic text-[var(--coral)]">look.</em>
      </h2>
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-6">
        {BOOTH_STYLES.map((s, i) => (
          <motion.button
            key={s.id}
            className={cn(
              "sticker-card relative flex min-h-0 flex-col overflow-hidden p-3 text-left",
              selected === s.id && "ring-[6px] ring-[var(--coral)]"
            )}
            initial={{ opacity: 0, y: 30, rotate: i % 2 ? 2 : -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPick(s.id)}
          >
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[20px] bg-[var(--ground)]">
              {s.id === "random" ? (
                <div className="flex h-full items-center justify-center text-[10vh]">🎲</div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.previewImage} alt={s.name} className="h-full w-full object-cover object-[center_20%]" />
              )}
            </div>
            <div className="flex items-baseline justify-between px-2 pt-3">
              <span className="display text-3xl font-semibold">{s.id === "random" ? "Surprise me" : s.name}</span>
              <span className="text-lg text-[var(--ink-3)]">{s.description}</span>
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
    <div className="flex h-full items-center justify-center gap-16 px-16 pb-10">
      <Mascot className="h-[62vh]" mood="working" />
      <div className="flex w-[44%] flex-col gap-8">
        {photo && (
          <div className="relative w-[46%] overflow-hidden rounded-[28px] border-8 border-white shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="aspect-square w-full object-cover" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.h2
            key={line}
            className="display text-[clamp(36px,3.8vw,64px)] leading-tight"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {LOADING_LINES[line]}
          </motion.h2>
        </AnimatePresence>
        <div className="h-5 w-full overflow-hidden rounded-full bg-[var(--ground)]">
          <motion.div className="h-full rounded-full bg-[var(--coral)]" animate={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-xl text-[var(--ink-2)]">Hang tight — this takes about 20 seconds.</p>
      </div>
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
      <div className="flex h-full items-center justify-center gap-16 px-16 pb-10">
        <Mascot className="h-[55vh]" />
        <div className="flex max-w-[40%] flex-col gap-6">
          <h2 className="display text-6xl leading-tight">
            Oops, that one <em className="italic text-[var(--coral)]">didn&apos;t develop.</em>
          </h2>
          <p className="text-2xl text-[var(--ink-2)]">Let&apos;s give it another shot. You haven&apos;t been charged.</p>
          <div className="flex gap-4">
            {canRetry && (
              <button className="btn-primary px-10 py-5 text-2xl" onClick={onRetry}>
                Try again
              </button>
            )}
            <button className="btn-ghost px-8 py-5 text-2xl" onClick={onRetake}>
              New photo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center gap-12 px-14 pb-10">
      <div className="relative flex h-full w-[50%] items-center justify-center">
        <motion.div
          className="absolute h-[70vh] w-[70vh] rounded-full bg-[var(--coral-pale)]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
        />
        <motion.img
          src={sticker}
          alt="Your sticker"
          className="relative h-[68vh] w-[68vh] object-contain [filter:drop-shadow(0_0_6px_#fff)_drop-shadow(0_0_6px_#fff)_drop-shadow(0_18px_24px_rgba(31,32,48,0.25))]"
          initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: -3, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 12, delay: 0.1 }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-6">
        <h2 className="display text-[clamp(44px,4.6vw,80px)] leading-[0.95]">
          Ta-da! <em className="italic text-[var(--coral)]">Love it?</em>
        </h2>
        {freeMode ? (
          <button className="btn-primary w-fit px-14 py-6 text-3xl" onClick={onPaid}>
            🖨️ Print my stickers
          </button>
        ) : (
          <PayWithQr styleId={styleId} onPaid={onPaid} />
        )}
        <div className="flex flex-wrap gap-3">
          {canRetry && (
            <>
              <button className="btn-ghost px-6 py-3 text-xl" onClick={onRetry}>
                🔄 Redo this style
              </button>
              <button className="btn-ghost px-6 py-3 text-xl" onClick={onOtherStyle}>
                🎨 Different style
              </button>
            </>
          )}
          <button className="btn-ghost px-6 py-3 text-xl" onClick={onRetake}>
            📸 New photo
          </button>
        </div>
      </div>
    </div>
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
        setQr(await QRCode.toDataURL(data.url, { width: 560, margin: 1, color: { dark: "#1f2030", light: "#ffffff" } }));
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
      <button className="btn-primary w-fit px-14 py-6 text-3xl" onClick={onPaid}>
        🖨️ Print my stickers
      </button>
    );
  }

  return (
    <div className="sticker-card flex w-fit items-center gap-8 p-6 pr-10">
      <div className="flex h-[30vh] w-[30vh] items-center justify-center overflow-hidden rounded-2xl bg-white">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Scan to pay" className="h-full w-full" />
        ) : state === "error" ? (
          <span className="p-4 text-center text-xl text-[var(--coral)]">Payment is down — please ask staff</span>
        ) : (
          <motion.span className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            ✨
          </motion.span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <div className="display text-6xl font-semibold">{BOOTH_PRICE_LABEL}</div>
        <div className="text-2xl font-semibold">Scan with your phone camera to pay</div>
        <div className="text-xl text-[var(--ink-2)]">
          {STICKERS_PER_SHEET} stickers · Apple Pay, Google Pay or card
        </div>
        {state === "waiting" && (
          <motion.div
            className="mt-2 text-lg text-[var(--sage)]"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            ● Waiting for payment — printing starts automatically
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
    <div className="flex h-full items-center justify-center gap-16 px-16 pb-10">
      <div className="flex w-[42%] flex-col gap-6">
        <h2 className="display text-[clamp(44px,4.6vw,80px)] leading-[0.95]">
          Printing your <em className="italic text-[var(--coral)]">stickers…</em>
        </h2>
        <p className="text-2xl text-[var(--ink-2)]">
          The printer prints, then cuts each sticker out. About {Math.max(0, Math.ceil(left / 10) * 10)} seconds.
        </p>
        <div className="h-5 w-full overflow-hidden rounded-full bg-[var(--ground)]">
          <motion.div
            className="h-full rounded-full bg-[var(--sage)]"
            animate={{ width: `${((PRINT_SECONDS - left) / PRINT_SECONDS) * 100}%` }}
          />
        </div>
        <button className="btn-primary w-fit px-10 py-5 text-2xl" onClick={onDone}>
          I&apos;ve got them! 🎉
        </button>
      </div>

      <div className="relative flex h-full w-[40%] flex-col items-center justify-center">
        <Mascot className="z-10 h-[34vh]" mood="excited" />
        {/* the printer slot + sheet sliding out */}
        <div className="relative z-20 h-6 w-[70%] rounded-full bg-[var(--ink)] shadow-lg" />
        <div className="relative h-[44vh] w-[60%] overflow-hidden">
          <motion.div
            className="absolute left-0 right-0 top-0 mx-auto w-full rounded-b-xl bg-white p-3 shadow-xl"
            initial={{ y: "-100%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 20, ease: "easeOut" }}
          >
            {sheet ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sheet} alt="Your sticker sheet" className="w-full" />
            ) : (
              <div className="aspect-[3.9/6.7] w-full bg-[var(--ground)]" />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ================================================================ done

function Done({ sticker, digitalUrl, onFinish }: { sticker: string | null; digitalUrl: string | null; onFinish: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (digitalUrl) QRCode.toDataURL(digitalUrl, { width: 420, margin: 1 }).then(setQr).catch(() => {});
  }, [digitalUrl]);

  return (
    <div className="relative flex h-full items-center justify-center gap-16 px-16 pb-10">
      <Confetti />
      <div className="relative flex w-[36%] items-center justify-center">
        {sticker && (
          <motion.img
            src={sticker}
            alt=""
            className="h-[56vh] object-contain [filter:drop-shadow(0_0_6px_#fff)_drop-shadow(0_0_6px_#fff)_drop-shadow(0_18px_24px_rgba(31,32,48,0.25))]"
            animate={{ rotate: [-4, 4, -4] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          />
        )}
      </div>
      <div className="flex w-[44%] flex-col gap-6">
        <h2 className="display text-[clamp(52px,5.4vw,96px)] leading-[0.92]">
          Peel, stick, <em className="italic text-[var(--coral)]">show off.</em>
        </h2>
        <p className="text-2xl text-[var(--ink-2)]">Grab your sheet from the tray below. Thanks for stopping by! 💛</p>
        {qr && (
          <div className="sticker-card flex w-fit items-center gap-6 p-5 pr-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Scan for digital copy" className="h-[20vh] w-[20vh]" />
            <div>
              <div className="text-2xl font-semibold">Want the digital copy?</div>
              <div className="text-xl text-[var(--ink-2)]">Scan to save it to your phone</div>
            </div>
          </div>
        )}
        <button className="btn-ghost w-fit px-8 py-4 text-xl" onClick={onFinish}>
          Done
        </button>
      </div>
    </div>
  );
}

function Confetti() {
  const colors = ["#e36f58", "#e1a52e", "#5e9271", "#f2b3a5", "#f4d48b"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-4 w-3 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length] }}
          initial={{ y: -40, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: 360 * (i % 2 ? 1 : -1) }}
          transition={{ duration: 3 + (i % 5) * 0.5, delay: (i % 10) * 0.15, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
