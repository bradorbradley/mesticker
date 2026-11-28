"use client";

/* eslint-disable @next/next/no-img-element -- stickers are data: URLs / blob URLs, next/image can't help */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationFrame, useMotionValue, type Transition } from "framer-motion";
import { Pointer } from "lucide-react";
import { sounds } from "@/lib/booth-sounds";
import { cn } from "@/lib/utils";
import { u } from "../units";

/**
 * Carol Games — three mini-games starring the guest's stickers, the hero and the
 * hosts, played while the sheet prints (387 Christmas Carols):
 *   Snowball Toss (4 throws) → Target Practice → Memory Match.
 * Each game opens with a short instruction card (with a looping example) that
 * auto-starts after a few seconds; the game's clock only runs during play.
 * After each game a ~1s result toast, then the next card. onDone() fires once
 * after the last game (or Skip / safety timer).
 */

const RED = "#a3161c";
const RED_DARK = "#6d0d10";
const CREAM = "#fbefd5";
const PAPER = "#fffaf0";
const GOLD = "#e2b65a";
const INK = "#3b1210";

/** the instruction card starts the game by itself after this long */
const INTRO_AUTO_MS = 5000;
/** result toast between games */
const RESULT_MS = 1200;
const TOSS_THROWS = 4;
const STICKER_SHADOW = "drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 4px 5px rgba(60,8,10,0.35))";

type Host = { name: string; img: string };

export type CarolGamesProps = {
  /** the guest's pose stickers (image srcs); duplicates are fine */
  stickers: string[];
  /** the guest's main cartoon sticker */
  hero: string;
  /** the hosts — regular characters in every game */
  hosts: { name: string; img: string }[];
  /** guest name for captions */
  name: string | null;
  /** total PLAY time across the games (instruction cards not counted), default 75 s */
  durationMs?: number;
  /** all games finished (or skipped / time ran out) — fires exactly once */
  onDone: () => void;
  /** play just this one game (0 toss, 1 target practice, 2 memory); durationMs is then its budget */
  only?: number;
};

type GameProps = {
  /** distinct characters, interleaved (hero, host, pose, host, pose…), never empty */
  pool: string[];
  hosts: Host[];
  name: string | null;
  durationMs: number;
  /** false while the instruction card / result toast is up: no input, no spawning */
  active: boolean;
  /** the game finished on its own (all throws / all pairs) */
  onComplete: () => void;
  onResult: (r: string) => void;
};

type GameDef = {
  id: string;
  title: string;
  howto: string;
  Comp: (p: GameProps) => React.ReactElement;
  Example: (p: { pool: string[] }) => React.ReactElement;
};

const GAMES: GameDef[] = [
  { id: "toss", title: "Snowball Toss", howto: "Swipe up to throw! You get 4 snowballs.", Comp: SnowballToss, Example: TossExample },
  { id: "target", title: "Target Practice", howto: "Tap the characters when they pop up!", Comp: TargetPractice, Example: TargetExample },
  { id: "memory", title: "Memory Match", howto: "Peek, then flip two cards to find a pair!", Comp: MemoryMatch, Example: MemoryExample },
];

// ---------------------------------------------------------------- helpers

/** deterministic pseudo-random in [0,1) — safe to use during render (no hydration mismatch) */
const seeded = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 1000) / 1000; // rounded so SSR and client print the same style strings
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const shuffled = <T,>(arr: T[]) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** [hero, host0, pose0, host1, pose1, host2, pose2, pose3…] — distinct, so neighbours differ */
function buildPool(stickers: string[], hero: string, hosts: Host[]) {
  const poses = stickers.filter(Boolean);
  const hostImgs = hosts.map((x) => x.img).filter(Boolean);
  const out: string[] = [];
  const add = (s?: string) => {
    if (s && !out.includes(s)) out.push(s);
  };
  add(hero);
  for (let i = 0; i < Math.max(poses.length, hostImgs.length); i++) {
    add(hostImgs[i]);
    add(poses[i]);
  }
  return out.length ? out : [hero];
}

function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}

function Sticker({ src, className, style, alt = "" }: { src: string; className?: string; style?: React.CSSProperties; alt?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("pointer-events-none select-none object-contain", className)}
      style={{ filter: STICKER_SHADOW, ...style }}
    />
  );
}

const comic: React.CSSProperties = {
  fontFamily: 'var(--font-comic, "Bangers"), "Fredoka", sans-serif',
  letterSpacing: "0.04em",
};
const script: React.CSSProperties = { fontFamily: 'var(--font-carol, "Lobster"), "Fredoka", cursive' };
const pill: React.CSSProperties = {
  ...comic,
  background: "#ffe36e",
  color: "#1a1a1a",
  border: "2px solid #1a1a1a",
  boxShadow: "3px 3px 0 #1a1a1a",
};

/** a little caption pill floating in a game */
function Caption({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 z-20 flex justify-center", className)} style={{ top: u(1), ...style }}>
      <motion.div
        key={String(children)}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
        className="max-w-[92%] truncate rounded-full text-center"
        style={{
          ...script,
          background: "rgba(255,250,240,0.94)",
          color: RED,
          border: `2px solid ${GOLD}`,
          boxShadow: "0 3px 8px rgba(60,8,10,0.2)",
          fontSize: `max(16px, ${u(2)})`,
          padding: `${u(0.3)} ${u(1.6)}`,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** a big comic "POW!" style burst */
function Burst({ text, size, color = "#ffe36e" }: { text: string; size: number; color?: string }) {
  const pts = Array.from({ length: 24 }, (_, i) => {
    const r = i % 2 ? 0.62 : 1;
    const a = (i / 24) * Math.PI * 2;
    return `${50 + Math.cos(a) * 50 * r},${50 + Math.sin(a) * 50 * r}`;
  }).join(" ");
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
        <polygon points={pts} fill={color} stroke="#1a1a1a" strokeWidth={3} strokeLinejoin="round" />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ ...comic, fontSize: size * 0.27, color: RED, WebkitTextStroke: "1px #1a1a1a" }}
      >
        {text}
      </div>
    </div>
  );
}

/** a puff of snow (misses) */
function Puff({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: size * 0.24,
            height: size * 0.24,
            left: size / 2 + Math.cos(i) * size * 0.32 - size * 0.12,
            top: size / 2 + Math.sin(i) * size * 0.3 - size * 0.12,
            boxShadow: "0 1px 3px rgba(60,60,100,0.4)",
          }}
        />
      ))}
    </div>
  );
}

function Snowball({ size, style, className }: { size: number; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={cn("rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 35% 30%, #fff 0%, #f3f7fb 50%, #c9d8e8 100%)",
        boxShadow: "0 2px 6px rgba(40,40,80,0.35)",
        ...style,
      }}
    />
  );
}

function Snow({ count = 26 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const size = 3 + seeded(i) * 6;
        return (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${seeded(i + 100) * 100}%`,
              top: 0,
              width: size,
              height: size,
              opacity: 0.55 + seeded(i + 200) * 0.4,
              boxShadow: "0 0 4px rgba(255,255,255,0.9)",
              animation: `cg-fall ${7 + seeded(i + 300) * 7}s linear ${-seeded(i + 400) * 14}s infinite`,
              ["--dx" as string]: `${(seeded(i + 500) - 0.5) * 80}px`,
            }}
          />
        );
      })}
    </div>
  );
}

function Sparkles({ n = 14 }: { n?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className="absolute"
          style={{
            left: `${seeded(i + 40) * 96}%`,
            top: `${seeded(i + 80) * 92}%`,
            width: 10 + seeded(i + 120) * 16,
            animation: `cg-twinkle ${0.9 + seeded(i + 160) * 1.2}s ease-in-out ${seeded(i + 200)}s infinite`,
          }}
        >
          <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill={GOLD} />
        </svg>
      ))}
    </div>
  );
}

const KEYFRAMES = `
@keyframes cg-fall { from { transform: translate3d(0,-20px,0); } to { transform: translate3d(var(--dx,0),110vh,0); } }
@keyframes cg-twinkle { 0%,100% { opacity: .35; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
`;

// ---------------------------------------------------------------- shell

type Phase = "intro" | "play" | "result";

export function CarolGames({ stickers, hero, hosts, name, durationMs = 75000, onDone, only }: CarolGamesProps) {
  const off = only == null ? 0 : Math.max(0, Math.min(GAMES.length - 1, Math.floor(only)));
  const games = only == null ? GAMES : [GAMES[off]];
  const pool = useMemo(() => buildPool(stickers, hero, hosts), [stickers, hero, hosts]);
  const per = Math.max(8000, durationMs / games.length);
  const last = games.length - 1;

  const [stage, setStage] = useState<{ idx: number; phase: Phase }>({ idx: 0, phase: "intro" });
  const [result, setResult] = useState("");
  const [now, setNow] = useState(0);
  const startedAt = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const finishAll = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }, []);

  const start = useCallback((idx: number) => {
    setStage((s) => (s.idx === idx && s.phase === "intro" ? { idx, phase: "play" } : s));
  }, []);
  const complete = useCallback((idx: number) => {
    setStage((s) => (s.idx === idx && s.phase === "play" ? { idx, phase: "result" } : s));
  }, []);
  const advance = useCallback(
    (idx: number) => {
      if (idx >= last) finishAll();
      else {
        setResult("");
        setStage({ idx: idx + 1, phase: "intro" });
      }
    },
    [last, finishAll]
  );

  // intro (auto-starts) → play (per-game clock) → result toast → next intro / done
  useEffect(() => {
    if (doneRef.current) return;
    if (stage.phase === "intro") {
      const t = setTimeout(() => start(stage.idx), INTRO_AUTO_MS);
      return () => clearTimeout(t);
    }
    if (stage.phase === "play") {
      startedAt.current = Date.now();
      setNow(Date.now());
      const t = setTimeout(() => complete(stage.idx), per);
      return () => clearTimeout(t);
    }
    sounds.success();
    const t = setTimeout(() => advance(stage.idx), RESULT_MS);
    return () => clearTimeout(t);
  }, [stage, per, start, complete, advance]);

  // safety net: never run past the whole budget, even if nobody touches anything
  useEffect(() => {
    const t = setTimeout(finishAll, games.length * (INTRO_AUTO_MS + per + RESULT_MS) + 3000);
    return () => clearTimeout(t);
  }, [games.length, per, finishAll]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const completeCurrent = useCallback(() => complete(stage.idx), [complete, stage.idx]);

  const skip = () => {
    sounds.tap();
    advance(stage.idx);
  };

  const game = games[stage.idx];
  const at = off + stage.idx; // position among all three games
  const Game = game.Comp;
  const playing = stage.phase === "play";
  const secsLeft =
    stage.phase === "intro"
      ? Math.round(per / 1000)
      : stage.phase === "result"
        ? 0
        : now
          ? Math.max(0, Math.ceil((startedAt.current + per - now) / 1000))
          : Math.round(per / 1000);
  const hurry = playing && secsLeft <= 3;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ color: INK }} data-testid="carol-games" data-game={game.id} data-phase={stage.phase}>
      <style>{KEYFRAMES}</style>

      {/* header: game label, title, timer, skip, bars */}
      <div className="relative z-20 flex shrink-0 flex-col" style={{ padding: `${u(0.9)} ${u(1.6)} ${u(0.7)}`, gap: u(0.55) }}>
        <div className="flex min-w-0 items-center" style={{ gap: u(1) }}>
          <span
            className="shrink-0 rounded-full font-bold uppercase"
            style={{
              background: RED,
              color: CREAM,
              fontSize: `max(11px, ${u(1.15)})`,
              padding: `${u(0.3)} ${u(1)}`,
              letterSpacing: "0.06em",
              boxShadow: `0 0 0 2px ${GOLD}`,
            }}
            data-testid="game-label"
          >
            Game {at + 1} of {GAMES.length}
          </span>
          <AnimatePresence mode="wait">
            <motion.h2
              key={game.id}
              className="min-w-0 flex-1 truncate"
              style={{ ...script, color: RED, fontSize: `max(19px, ${u(2.7)})`, lineHeight: 1.1, textShadow: "0 2px 0 #fff6e3" }}
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {game.title}
            </motion.h2>
          </AnimatePresence>
          <motion.span
            key={hurry ? secsLeft : "calm"}
            initial={hurry ? { scale: 1.5 } : false}
            animate={{ scale: 1 }}
            className="shrink-0 tabular-nums"
            style={{ ...comic, color: hurry ? RED : INK, fontSize: `max(17px, ${u(2.2)})` }}
            data-testid="secs"
          >
            {secsLeft}s
          </motion.span>
          <button
            type="button"
            onClick={skip}
            className="btn btn-soft shrink-0"
            style={{ padding: `max(6px, ${u(0.45)}) max(14px, ${u(1.3)})`, fontSize: `max(14px, ${u(1.4)})` }}
            data-testid="skip"
          >
            Skip ›
          </button>
        </div>

        {/* this game's countdown (full while the card shows, shrinks during play) */}
        <div
          className="relative w-full overflow-hidden rounded-full"
          style={{ height: `max(10px, ${u(1.1)})`, background: "rgba(163,22,28,0.14)", boxShadow: "inset 0 1px 2px rgba(60,8,10,0.25)" }}
        >
          <motion.div
            key={`${stage.idx}-${stage.phase}`}
            data-testid="game-bar"
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: hurry ? `linear-gradient(90deg, #d32f2f, ${RED})` : `repeating-linear-gradient(-45deg, ${GOLD} 0 10px, #f0cf83 10px 20px)`,
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.12)",
            }}
            initial={{ width: stage.phase === "result" ? "0%" : "100%" }}
            animate={{ width: playing ? "0%" : stage.phase === "intro" ? "100%" : "0%" }}
            transition={{ duration: playing ? per / 1000 : 0, ease: "linear" }}
          />
        </div>

        {/* overall progress: one segment per game */}
        <div className="flex w-full" style={{ gap: u(0.5) }}>
          {GAMES.map((g, i) => (
            <div key={g.id} className="relative flex-1 overflow-hidden rounded-full" style={{ height: `max(4px, ${u(0.45)})`, background: "rgba(163,22,28,0.14)" }}>
              {i < at || (i === at && stage.phase === "result") ? (
                <div className="absolute inset-0" style={{ background: RED }} />
              ) : i === at && playing ? (
                <motion.div
                  key={stage.idx}
                  data-testid="overall-bar"
                  className="absolute inset-y-0 left-0"
                  style={{ background: RED }}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: per / 1000, ease: "linear" }}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* game area */}
      <div className="relative min-h-0 flex-1" style={{ margin: `0 ${u(1.6)} ${u(1.6)}` }}>
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            borderRadius: u(2.2),
            border: `max(3px, ${u(0.35)}) solid #f7e6c4`,
            boxShadow: `0 0 0 2px ${GOLD}, 0 ${u(0.9)} ${u(2.4)} rgba(110,13,16,0.25)`,
            background: PAPER,
          }}
        >
          <Game key={game.id} pool={pool} hosts={hosts} name={name} durationMs={per} active={playing} onComplete={completeCurrent} onResult={setResult} />

          {/* result toast */}
          <AnimatePresence>
            {stage.phase === "result" && (
              <motion.div
                key={`res-${stage.idx}`}
                className="absolute inset-0 z-30 flex items-center justify-center"
                style={{ background: "rgba(255,250,240,0.45)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                data-testid="result-toast"
              >
                <motion.div
                  initial={{ scale: 0.3, rotate: -12 }}
                  animate={{ scale: 1, rotate: -3 }}
                  transition={{ type: "spring", stiffness: 480, damping: 12 }}
                  className="max-w-[90%] rounded-[20px] text-center"
                  style={{ ...script, background: RED, color: CREAM, border: `3px solid ${GOLD}`, fontSize: `max(24px, ${u(3.8)})`, lineHeight: 1.1, padding: `${u(1)} ${u(3)}`, boxShadow: "0 8px 20px rgba(60,8,10,0.4)" }}
                >
                  {result || "Nice!"}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* instruction card */}
      <AnimatePresence>
        {stage.phase === "intro" && (
          <IntroCard key={`intro-${game.id}`} n={at + 1} game={game} pool={pool} onStart={() => start(stage.idx)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function IntroCard({ n, game, pool, onStart }: { n: number; game: GameDef; pool: string[]; onStart: () => void }) {
  const Example = game.Example;
  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center"
      style={{ background: "rgba(60,8,10,0.55)", padding: u(2) }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      data-testid="intro"
    >
      <motion.div
        role="dialog"
        aria-label={game.title}
        className="relative flex w-full max-w-[440px] flex-col items-center overflow-hidden text-center [@media(max-height:520px)]:max-w-[620px] [@media(max-height:520px)]:flex-row [@media(max-height:520px)]:text-left"
        style={{
          background: `linear-gradient(180deg, ${PAPER} 0%, ${CREAM} 100%)`,
          border: `3px solid ${GOLD}`,
          borderRadius: 24,
          boxShadow: `0 0 0 3px ${RED}, 0 16px 40px rgba(40,4,6,0.5)`,
          padding: "max(16px, 2.4vmin)",
          gap: "max(10px, 1.6vmin)",
        }}
        initial={{ scale: 0.7, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
      >
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: 200,
            height: 132,
            borderRadius: 16,
            background: "linear-gradient(180deg, #2a1a3e 0%, #5a2a4a 45%, #f3d6c0 85%, #fff6ea 100%)",
            boxShadow: `inset 0 0 0 2px ${GOLD}`,
          }}
          data-testid="intro-example"
        >
          <Example pool={pool} />
        </div>
        <div className="flex min-w-0 flex-col items-center [@media(max-height:520px)]:items-start" style={{ gap: "max(8px, 1.2vmin)" }}>
          <span
            className="rounded-full font-bold uppercase"
            style={{ background: RED, color: CREAM, fontSize: 12, padding: "3px 12px", letterSpacing: "0.08em", boxShadow: `0 0 0 2px ${GOLD}` }}
          >
            Game {n} of {GAMES.length}
          </span>
          <div style={{ ...script, color: RED, fontSize: "clamp(28px, 6vmin, 44px)", lineHeight: 1.05, textShadow: "0 2px 0 #fff" }}>{game.title}</div>
          <div className="font-bold" style={{ color: INK, fontSize: "clamp(16px, 2.6vmin, 21px)", lineHeight: 1.25 }} data-testid="intro-howto">
            {game.howto}
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.unlock();
              sounds.tap();
              onStart();
            }}
            className="relative overflow-hidden rounded-full"
            style={{
              ...comic,
              background: RED,
              color: CREAM,
              border: `3px solid ${GOLD}`,
              boxShadow: `0 5px 0 ${RED_DARK}, 0 8px 16px rgba(60,8,10,0.35)`,
              fontSize: "clamp(22px, 3.6vmin, 30px)",
              padding: "6px 34px",
              marginTop: 4,
            }}
            data-testid="intro-go"
          >
            {/* fills up until the card starts the game by itself */}
            <motion.span
              aria-hidden
              className="absolute inset-y-0 left-0"
              style={{ background: "rgba(255,255,255,0.18)" }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: INTRO_AUTO_MS / 1000, ease: "linear" }}
            />
            <span className="relative">Let&apos;s go!</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------- examples (looping, in a 200×132 box)

function Hand({ style, animate, transition }: { style?: React.CSSProperties; animate: Record<string, number[]>; transition: Transition }) {
  return (
    <motion.div className="pointer-events-none absolute left-0 top-0 z-10" style={{ width: 34, height: 34, ...style }} animate={animate} transition={transition}>
      <Pointer size={34} strokeWidth={2.2} color="#1a1a1a" fill="#fff" style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.35))" }} />
    </motion.div>
  );
}

function TossExample({ pool }: { pool: string[] }) {
  const loop = { duration: 2.6, repeat: Infinity, ease: "easeInOut" } as const;
  const times = [0, 0.12, 0.3, 0.55, 0.62, 0.85, 1];
  return (
    <>
      {/* snowy ledge + wreath with a character */}
      <div className="absolute inset-x-0" style={{ top: 50, height: 30, background: "linear-gradient(180deg,#fff,#e4edf6)", borderRadius: "50% 50% 0 0 / 60% 60% 0 0" }} />
      <div className="absolute" style={{ left: 74, top: 44, width: 52, height: 16, borderRadius: "50%", border: "5px solid #2f7a3c", boxShadow: "0 0 0 2px #fff inset" }} />
      <motion.div
        className="absolute"
        style={{ left: 80, top: 8, width: 40, height: 44 }}
        animate={{ rotate: [0, 0, 0, 0, -16, 10, 0], scale: [1, 1, 1, 1, 0.9, 1.05, 1] }}
        transition={{ ...loop, times }}
      >
        <Sticker src={pool[0]} className="h-full w-full" />
      </motion.div>
      {/* ball: rests, gets swiped, arcs up and shrinks */}
      <motion.div
        className="absolute left-0 top-0"
        animate={{ x: [88, 88, 88, 92, 92, 88, 88], y: [104, 104, 92, 22, 22, 104, 104], scale: [1, 1, 1, 0.5, 0, 0, 1], opacity: [1, 1, 1, 1, 0, 0, 1] }}
        transition={{ ...loop, times }}
      >
        <Snowball size={24} />
      </motion.div>
      {/* splat */}
      <motion.div
        className="absolute left-0 top-0"
        style={{ x: 70, y: 0 }}
        animate={{ scale: [0, 0, 0, 0, 1, 1, 0], opacity: [0, 0, 0, 0, 1, 1, 0] }}
        transition={{ ...loop, times }}
      >
        <Burst text="SPLAT!" size={60} />
      </motion.div>
      <Hand animate={{ x: [104, 96, 96, 100, 104, 104, 104], y: [124, 108, 84, 70, 110, 124, 124], opacity: [0, 1, 1, 0, 0, 0, 0] }} transition={{ ...loop, times }} />
    </>
  );
}

function TargetExample({ pool }: { pool: string[] }) {
  const loop = { duration: 2.4, repeat: Infinity, ease: "easeInOut" } as const;
  const times = [0, 0.12, 0.35, 0.45, 0.55, 0.8, 1];
  const a = pool[1 % pool.length];
  return (
    <>
      {[20, 76, 132].map((x, i) => (
        <div key={i} className="absolute" style={{ left: x, top: 92, width: 50, height: 22 }}>
          <div className="absolute inset-0" style={{ borderRadius: "50% 50% 18% 18% / 90% 90% 22% 22%", background: "radial-gradient(ellipse at 40% 25%, #fff 0%, #f2f6fb 55%, #d6e3f0 100%)" }} />
        </div>
      ))}
      {/* the popper (clipped behind the middle bank) */}
      <div className="absolute overflow-hidden" style={{ left: 76, top: 40, width: 50, height: 60 }}>
        <motion.div
          className="absolute left-[3px] top-0"
          style={{ width: 44, height: 56 }}
          animate={{ y: [60, 4, 4, 4, 4, 60, 60], rotate: [0, 0, 0, -16, 10, 0, 0] }}
          transition={{ ...loop, times }}
        >
          <Sticker src={a} className="h-full w-full" />
        </motion.div>
      </div>
      <motion.div className="absolute left-0 top-0" style={{ x: 70, y: 22 }} animate={{ scale: [0, 0, 0, 1, 1, 0, 0], opacity: [0, 0, 0, 1, 1, 0, 0] }} transition={{ ...loop, times }}>
        <Burst text="POW!" size={60} />
      </motion.div>
      <Hand animate={{ x: [170, 150, 102, 98, 102, 170, 170], y: [130, 110, 72, 76, 72, 130, 130], scale: [1, 1, 1, 0.8, 1, 1, 1], opacity: [0, 1, 1, 1, 1, 0, 0] }} transition={{ ...loop, times }} />
    </>
  );
}

function MemoryExample({ pool }: { pool: string[] }) {
  const loop = { duration: 3, repeat: Infinity, ease: "easeInOut" } as const;
  const times = [0, 0.12, 0.2, 0.4, 0.48, 0.62, 0.82, 0.92, 1];
  const face = pool[2 % pool.length];
  const xs = [18, 62, 106, 150];
  // card 0 flips at .2, card 2 at .48, both glow, flip back at .92
  const flipA = [0, 0, 180, 180, 180, 180, 180, 0, 0];
  const flipB = [0, 0, 0, 0, 180, 180, 180, 0, 0];
  const glow = [0, 0, 0, 0, 0, 1, 1, 0, 0];
  return (
    <>
      {xs.map((x, i) => {
        const flips = i === 0 ? flipA : i === 2 ? flipB : null;
        return (
          <div key={i} className="absolute" style={{ left: x, top: 34, width: 34, height: 44, perspective: 300 }}>
            <motion.div
              className="absolute inset-0"
              style={{ transformStyle: "preserve-3d" }}
              animate={flips ? { rotateY: flips } : undefined}
              transition={{ ...loop, times }}
            >
              <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <CardBack small />
              </div>
              <div
                className="absolute inset-0"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", background: PAPER, borderRadius: 6, border: `2px solid ${GOLD}`, padding: 2 }}
              >
                <Sticker src={face} className="h-full w-full" />
              </div>
            </motion.div>
            {flips && (
              <motion.div
                className="pointer-events-none absolute -inset-1 rounded-[8px]"
                style={{ boxShadow: `0 0 0 3px ${GOLD}, 0 0 14px ${GOLD}` }}
                animate={{ opacity: glow }}
                transition={{ ...loop, times }}
              />
            )}
          </div>
        );
      })}
      <Hand
        animate={{ x: [60, 30, 30, 118, 118, 160, 160, 160, 60], y: [130, 64, 60, 64, 60, 110, 130, 130, 130], opacity: [0, 1, 1, 1, 1, 1, 0, 0, 0] }}
        transition={{ ...loop, times }}
      />
    </>
  );
}

// ---------------------------------------------------------------- 1. Snowball Toss (4 throws)

type Flight = { id: number; x0: number; y0: number; x1: number; y1: number; ms: number };
type Outcome = { id: number; hit: boolean; x: number; y: number };

function SnowballToss({ pool, active, onComplete, onResult }: GameProps) {
  const [ref, { w, h }] = useBox<HTMLDivElement>();
  const S = Math.max(60, Math.min(w * 0.3, h * 0.3)); // target character size
  const ty = Math.max(S * 0.55, h * 0.24); // character centre
  const ledgeTop = ty + S * 0.38;
  const ball = Math.max(40, Math.min(w, h) * 0.13);
  const bx = w / 2;
  const by = h - ball * 0.5 - Math.max(16, h * 0.05);
  const amp = Math.max(0, Math.min(w * 0.3, w / 2 - S * 0.6));

  const targets = useMemo(() => Array.from({ length: TOSS_THROWS }, (_, k) => pool[k % pool.length]), [pool]);
  const [throwIdx, setThrowIdx] = useState(0);
  const [marks, setMarks] = useState<("hit" | "miss")[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [wobble, setWobble] = useState(0);
  const [thrown, setThrown] = useState(false);
  const busy = useRef(false);
  const down = useRef<{ x: number; y: number; id: number } | null>(null);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  // the target slides gently side to side (a bit quicker each throw)
  const tx = useMotionValue(0);
  const phase = useRef(0);
  const throwRef = useRef(0);
  useEffect(() => {
    throwRef.current = throwIdx;
  }, [throwIdx]);
  useAnimationFrame((_, delta) => {
    const period = [7000, 6200, 5600, 5000][Math.min(3, throwRef.current)];
    phase.current += (Math.min(delta, 50) / period) * Math.PI * 2;
    tx.set(Math.sin(phase.current) * amp);
  });

  const hits = marks.filter((m) => m === "hit").length;
  useEffect(() => {
    onResult(`${hits} of ${TOSS_THROWS} hits!`);
  }, [hits, onResult]);

  const throwBall = (dx: number, dy: number) => {
    if (!active || busy.current || throwIdx >= TOSS_THROWS || !w) return;
    busy.current = true;
    setThrown(true);
    sounds.unlock();
    sounds.tap();
    // direction from the swipe; a tap (or a weird swipe) goes straight up
    const up = -dy;
    const slope = up > 12 ? Math.max(-1.6, Math.min(1.6, dx / up)) : 0;
    const x1 = Math.max(ball / 2, Math.min(w - ball / 2, bx + slope * (by - ty)));
    const ms = 620;
    const f: Flight = { id: nextId.current++, x0: bx, y0: by, x1, y1: ty, ms };
    setFlight(f);
    later(ms, () => {
      const centre = w / 2 + tx.get();
      const hit = Math.abs(x1 - centre) < S * 0.42;
      setFlight(null);
      setOutcome({ id: f.id, hit, x: hit ? centre : x1, y: hit ? ty : ledgeTop + S * 0.05 });
      setMarks((m) => [...m, hit ? "hit" : "miss"]);
      if (hit) {
        setWobble((x) => x + 1);
        sounds.tick();
      }
      later(950, () => {
        setOutcome(null);
        const n = throwRef.current + 1;
        setThrowIdx(n);
        if (n >= TOSS_THROWS) later(250, onComplete);
        else busy.current = false;
      });
    });
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    down.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = down.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (dy < -50) {
      down.current = null;
      throwBall(dx, dy);
    }
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = down.current;
    down.current = null;
    if (!d || d.id !== e.pointerId) return;
    throwBall(e.clientX - d.x, e.clientY - d.y);
  };

  const src = targets[Math.min(throwIdx, TOSS_THROWS - 1)];
  const ballReady = !flight && throwIdx < TOSS_THROWS && !outcome;

  return (
    <div
      ref={ref}
      className="absolute inset-0 touch-none select-none overflow-hidden"
      style={{ background: "linear-gradient(180deg, #2a1a3e 0%, #5a2a4a 30%, #f3d6c0 70%, #fff6ea 100%)" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => (down.current = null)}
      data-testid="toss-area"
      data-throw={throwIdx}
      data-hits={hits}
    >
      <div
        className="pointer-events-none absolute rounded-full"
        style={{ right: "7%", top: "5%", width: Math.min(w, h) * 0.11, height: Math.min(w, h) * 0.11, background: "#fff3cf", boxShadow: "0 0 30px 8px rgba(255,236,180,0.5)" }}
      />
      <Sparkles n={8} />
      <Snow count={18} />

      {w > 0 && (
        <>
          {/* snowy ledge the target rides on */}
          <div
            className="pointer-events-none absolute inset-x-0"
            style={{
              top: ledgeTop,
              height: Math.max(26, S * 0.5),
              background: "linear-gradient(180deg, #ffffff 0%, #eef3f9 60%, #d6e3f0 100%)",
              borderRadius: "50% 50% 0 0 / 40% 40% 0 0",
              boxShadow: "0 6px 0 rgba(120,150,190,0.25)",
            }}
          />

          {/* the target: wreath platform + character, sliding */}
          <motion.div className="pointer-events-none absolute left-0 top-0" style={{ x: tx, left: w / 2 - S / 2, top: ty - S / 2, width: S, height: S }} data-testid="toss-target">
            <div
              className="absolute left-1/2 rounded-[50%]"
              style={{
                bottom: -S * 0.02,
                width: S * 1.05,
                height: S * 0.3,
                marginLeft: -S * 0.525,
                border: `${Math.max(5, S * 0.08)}px solid #2f7a3c`,
                boxShadow: `inset 0 0 0 2px #fff, 0 3px 0 rgba(0,0,0,0.15)`,
                background: "radial-gradient(ellipse, #ffffff 0%, #e8eff7 70%)",
              }}
            >
              {[0.1, 0.35, 0.65, 0.9].map((p, i) => (
                <span key={i} className="absolute rounded-full" style={{ left: `${p * 100}%`, top: i % 2 ? "-30%" : "75%", width: 7, height: 7, background: i % 2 ? RED : GOLD }} />
              ))}
            </div>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`${throwIdx}-${src}`}
                className="absolute inset-x-0 top-0"
                style={{ height: S * 0.92, transformOrigin: "50% 95%" }}
                initial={{ scale: 0, y: -S * 0.4 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 420, damping: 16 }}
              >
                <motion.div
                  key={wobble}
                  className="relative h-full w-full"
                  style={{ transformOrigin: "50% 95%" }}
                  animate={wobble ? { rotate: [0, -18, 14, -9, 5, 0], scale: [1, 0.86, 1.06, 0.97, 1] } : { rotate: [0, -3, 3, 0] }}
                  transition={wobble ? { duration: 0.6 } : { duration: 1.4, repeat: Infinity }}
                >
                  <Sticker src={src} className="h-full w-full" />
                  {outcome?.hit && (
                    <motion.div
                      className="absolute rounded-[45%] bg-white"
                      style={{ left: "32%", top: "18%", width: S * 0.36, height: S * 0.26, boxShadow: "0 0 6px #fff, 6px 4px 0 -2px #fff, -6px 6px 0 -3px #fff" }}
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.3, 1] }}
                      transition={{ duration: 0.25 }}
                    />
                  )}
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* swipe hint above the resting ball */}
          {active && !thrown && ballReady && (
            <motion.div
              className="pointer-events-none absolute"
              style={{ left: bx - 14, top: by - ball * 0.5 - 46, width: 28, height: 40 }}
              animate={{ y: [8, -8, 8], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.1, repeat: Infinity }}
            >
              <svg viewBox="0 0 28 40" className="h-full w-full">
                <path d="M14 38 V6 M4 16 L14 4 L24 16" stroke="#fff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M14 38 V6 M4 16 L14 4 L24 16" stroke={RED} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </motion.div>
          )}

          {/* the resting ball */}
          <AnimatePresence>
            {ballReady && (
              <motion.div
                key={`rest-${throwIdx}`}
                className="pointer-events-none absolute"
                style={{ left: bx - ball / 2, top: by - ball / 2 }}
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.05 } }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                data-testid="toss-ball"
              >
                <Snowball size={ball} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ball in flight: arcs up, shrinks with distance */}
          {flight && (
            <motion.div
              key={flight.id}
              className="pointer-events-none absolute left-0 top-0 z-10"
              style={{ marginLeft: -ball / 2, marginTop: -ball / 2 }}
              initial={{ x: flight.x0, y: flight.y0, scale: 1 }}
              animate={{
                x: [flight.x0, flight.x0 + (flight.x1 - flight.x0) * 0.55, flight.x1],
                y: [flight.y0, flight.y1 - Math.min(h * 0.12, S * 0.6), flight.y1],
                scale: [1, 0.68, 0.42],
              }}
              transition={{ duration: flight.ms / 1000, ease: "easeOut", times: [0, 0.6, 1] }}
            >
              <Snowball size={ball} />
            </motion.div>
          )}

          {/* splat / puff */}
          <AnimatePresence>
            {outcome && (
              <motion.div
                key={outcome.id}
                className="pointer-events-none absolute z-20"
                style={{ left: outcome.x - (outcome.hit ? S * 0.6 : S * 0.3), top: outcome.y - (outcome.hit ? S * 0.6 : S * 0.3) }}
                initial={{ scale: 0.2, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 1.3, opacity: 0, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 600, damping: 14 }}
                data-testid={outcome.hit ? "toss-hit" : "toss-miss"}
              >
                {outcome.hit ? <Burst text="SPLAT!" size={S * 1.2} /> : <Puff size={S * 0.6} />}
              </motion.div>
            )}
          </AnimatePresence>
          {outcome && !outcome.hit && <Caption style={{ top: Math.min(h * 0.62, ledgeTop + S * 0.6) }}>So close!</Caption>}
        </>
      )}

      {/* hits */}
      <div className="pointer-events-none absolute z-20 rounded-full" style={{ left: u(1), top: u(1), ...pill, fontSize: `max(16px, ${u(2)})`, padding: `${u(0.1)} ${u(1.2)}` }} data-testid="toss-score">
        Hits {hits}
      </div>

      {/* 4 snowball pips */}
      <div className="pointer-events-none absolute z-20 flex items-center" style={{ left: u(1.2), bottom: u(1.2), gap: 8 }} data-testid="toss-pips">
        {Array.from({ length: TOSS_THROWS }, (_, i) => {
          const m = marks[i];
          const current = i === throwIdx && !m;
          return (
            <motion.div
              key={i}
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: 22,
                height: 22,
                background: m ? (m === "hit" ? GOLD : "rgba(255,255,255,0.35)") : "radial-gradient(circle at 35% 30%, #fff 0%, #eef3f9 55%, #c9d8e8 100%)",
                border: `2px solid ${m === "hit" ? "#1a1a1a" : m ? "rgba(26,26,26,0.35)" : "#1a1a1a"}`,
                ...comic,
                fontSize: 13,
                color: "#1a1a1a",
              }}
              animate={current && active ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={current && active ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
              data-mark={m ?? ""}
            >
              {m === "hit" ? "✓" : m === "miss" ? "×" : ""}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 2. Target Practice (whack-a-mole, relaxed)

type Pop = { id: number; hole: number; src: string; until: number; hit: boolean };
type Ball = { id: number; x0: number; y0: number; x: number; y: number };
type Pow = { id: number; x: number; y: number; text: string; hit: boolean };

const POWS = ["POW!", "SPLAT!", "BAM!", "WHAM!", "BOOF!"];

function TargetPractice({ pool, active, onResult }: GameProps) {
  const [ref, { w, h }] = useBox<HTMLDivElement>();
  const land = w > h * 1.2;
  const cols = land ? 4 : 3;
  const rows = land ? 2 : 3;
  const holes = cols * rows;
  const topPad = Math.min(54, h * 0.13);
  const cellW = w / cols;
  const cellH = (h - topPad) / rows;
  const S = Math.min(cellW * 0.8, cellH * 0.8);
  const bankH = S * 0.34;

  const [pops, setPops] = useState<Pop[]>([]);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [pows, setPows] = useState<Pow[]>([]);
  const [score, setScore] = useState(0);
  const [bump, setBump] = useState(0);
  const nextId = useRef(1);
  const turn = useRef(TOSS_THROWS); // rotation through the pool, picking up where the toss left off

  useEffect(() => {
    onResult(`${score} ${score === 1 ? "hit" : "hits"}!`);
  }, [score, onResult]);

  // spawner: one at a time to begin with, at most two later; each stays up ~1.6–2.2 s
  useEffect(() => {
    if (!holes || !active) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const began = Date.now();
    const spawn = () => {
      if (!alive) return;
      const now = Date.now();
      setPops((cur) => {
        const live = cur.filter((p) => p.until > now);
        const max = now - began < 7000 ? 1 : 2;
        if (live.filter((p) => !p.hit).length >= max) return live;
        const free = Array.from({ length: holes }, (_, i) => i).filter((i) => !live.some((p) => p.hole === i));
        if (!free.length) return live;
        // next character in rotation that isn't already on screen
        let src = pool[turn.current++ % pool.length];
        for (let k = 0; k < pool.length && live.some((p) => p.src === src); k++) src = pool[turn.current++ % pool.length];
        return [...live, { id: nextId.current++, hole: pick(free), src, until: now + rnd(1600, 2200), hit: false }];
      });
      timer = setTimeout(spawn, rnd(850, 1300));
    };
    timer = setTimeout(spawn, 300);
    const sweep = setInterval(() => {
      const now = Date.now();
      setPops((cur) => (cur.some((p) => p.until <= now) ? cur.filter((p) => p.until > now) : cur));
    }, 100);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(sweep);
    };
  }, [holes, pool, active]);

  const holeCenter = (hole: number) => {
    const c = hole % cols;
    const r = Math.floor(hole / cols);
    const cx = cellW * (c + 0.5);
    const bankTop = topPad + cellH * (r + 1) - cellH * 0.06 - bankH;
    return { cx, cy: bankTop + bankH * 0.45 - S * 0.5, bankTop };
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    sounds.unlock();
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const now = Date.now();
    let target: Pop | undefined;
    let best = Infinity;
    for (const p of pops) {
      if (p.hit || p.until <= now) continue;
      const { cx, cy } = holeCenter(p.hole);
      const d = Math.hypot(x - cx, y - cy);
      if (d < S * 0.65 && d < best) {
        best = d;
        target = p;
      }
    }
    const ball: Ball = { id: nextId.current++, x0: w / 2, y0: h + 10, x, y };
    setBalls((b) => [...b, ball]);
    setTimeout(() => setBalls((b) => b.filter((q) => q.id !== ball.id)), 320);
    sounds.tap();
    if (target) {
      const tid = target.id;
      setPops((cur) => cur.map((p) => (p.id === tid ? { ...p, hit: true, until: Date.now() + 850 } : p)));
      setScore((s) => s + 1);
      setTimeout(() => {
        setBump((b) => b + 1);
        sounds.tick();
      }, 260);
    }
    const pow: Pow = { id: nextId.current++, x, y, text: target ? pick(POWS) : "poof", hit: !!target };
    setTimeout(() => setPows((p) => [...p, pow]), 260);
    setTimeout(() => setPows((p) => p.filter((q) => q.id !== pow.id)), 1000);
  };

  return (
    <div
      ref={ref}
      className="absolute inset-0 touch-none overflow-hidden"
      style={{ background: "linear-gradient(180deg, #2a1a3e 0%, #5a2a4a 38%, #f3d6c0 78%, #fff6ea 100%)" }}
      onPointerDown={onDown}
      data-testid="target-area"
    >
      <div
        className="pointer-events-none absolute rounded-full"
        style={{ right: "8%", top: "6%", width: Math.min(w, h) * 0.13, height: Math.min(w, h) * 0.13, background: "#fff3cf", boxShadow: "0 0 30px 8px rgba(255,236,180,0.5)" }}
      />
      <Sparkles n={10} />
      <Snow />

      {w > 0 &&
        Array.from({ length: holes }, (_, hole) => {
          const { cx, bankTop } = holeCenter(hole);
          const pop = pops.find((p) => p.hole === hole);
          const winBottom = bankTop + bankH * 0.45;
          return (
            <div key={hole}>
              {/* sticker window: clipped so characters rise from behind the bank */}
              <div className="pointer-events-none absolute overflow-hidden" style={{ left: cx - S * 0.6, width: S * 1.2, top: winBottom - S * 1.15, height: S * 1.15 }}>
                <AnimatePresence>
                  {pop && (
                    <motion.div
                      key={pop.id}
                      className="absolute bottom-0 left-1/2"
                      style={{ width: S, height: S, marginLeft: -S / 2 }}
                      initial={{ y: S }}
                      animate={{ y: S * 0.04 }}
                      exit={{ y: S, transition: { duration: 0.22 } }}
                      transition={{ type: "spring", stiffness: 380, damping: 22 }}
                      data-testid="pop"
                      data-src={pop.src}
                    >
                      <motion.div
                        className="h-full w-full"
                        style={{ transformOrigin: "50% 90%" }}
                        animate={
                          pop.hit
                            ? { rotate: [0, -18, 14, -10, 6, 0], scale: [1, 0.86, 1.06, 0.96, 1], transition: { delay: 0.25, duration: 0.55 } }
                            : { rotate: [0, -3, 3, 0], transition: { duration: 0.9, repeat: Infinity } }
                        }
                      >
                        <Sticker src={pop.src} className="h-full w-full" />
                        {pop.hit && (
                          <motion.div
                            className="absolute rounded-full bg-white"
                            style={{ left: "35%", top: "22%", width: S * 0.3, height: S * 0.22, boxShadow: "0 0 6px #fff" }}
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.3, 1] }}
                            transition={{ delay: 0.26, duration: 0.25 }}
                          />
                        )}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* the snowbank */}
              <div
                className="pointer-events-none absolute"
                style={{
                  left: cx - cellW * 0.46,
                  width: cellW * 0.92,
                  top: bankTop,
                  height: bankH,
                  borderRadius: "50% 50% 18% 18% / 90% 90% 22% 22%",
                  background: "radial-gradient(ellipse at 40% 25%, #ffffff 0%, #f2f6fb 55%, #d6e3f0 100%)",
                  boxShadow: "0 4px 0 rgba(120,150,190,0.35), inset 0 -4px 6px rgba(140,170,210,0.35)",
                }}
              />
            </div>
          );
        })}

      {/* snowballs in flight */}
      {balls.map((b) => {
        const size = Math.max(20, S * 0.26);
        const midY = Math.max(size, Math.min(b.y0, b.y) - h * 0.15);
        return (
          <motion.div
            key={b.id}
            className="pointer-events-none absolute left-0 top-0"
            style={{ marginLeft: -size / 2, marginTop: -size / 2 }}
            initial={{ x: b.x0, y: b.y0, scale: 1.7 }}
            animate={{ x: [b.x0, (b.x0 + b.x) / 2, b.x], y: [b.y0, midY, b.y], scale: [1.7, 1.1, 0.75] }}
            transition={{ duration: 0.27, ease: "easeOut" }}
          >
            <Snowball size={size} />
          </motion.div>
        );
      })}

      {/* POW! bursts */}
      <AnimatePresence>
        {pows.map((p) => {
          const size = p.hit ? Math.max(70, S * 0.8) : Math.max(44, S * 0.45);
          return (
            <motion.div
              key={p.id}
              className="pointer-events-none absolute z-10"
              style={{ left: p.x - size / 2, top: p.y - size / 2 }}
              initial={{ scale: 0.2, rotate: -20, opacity: 1 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 1.3, opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 600, damping: 14 }}
            >
              {p.hit ? <Burst text={p.text} size={size} /> : <Puff size={size} />}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* score */}
      <motion.div
        key={bump}
        className="pointer-events-none absolute z-20 flex items-center rounded-full"
        style={{ left: u(1), top: u(1), ...pill, fontSize: `max(17px, ${u(2.1)})`, padding: `${u(0.1)} ${u(1.2)}` }}
        initial={{ scale: bump ? 1.45 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
        data-testid="target-score"
      >
        ❄ {score}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------- 3. Memory Match

function CardBack({ small }: { small?: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        borderRadius: small ? 6 : "12%/10%",
        background: `radial-gradient(circle, rgba(255,255,255,0.12) 1.5px, transparent 2px) 0 0 / 14px 14px, linear-gradient(150deg, #c0262c 0%, ${RED} 50%, ${RED_DARK} 100%)`,
        border: `${small ? 2 : 3}px solid ${CREAM}`,
        boxShadow: "0 4px 8px rgba(60,8,10,0.3)",
      }}
    >
      <div className="absolute inset-[7%]" style={{ border: `${small ? 1 : 2}px solid ${GOLD}`, borderRadius: "10%/8%" }} />
      <svg viewBox="0 0 100 100" className="absolute left-1/2 top-1/2 w-[56%] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <g stroke={GOLD} strokeWidth={5} strokeLinecap="round" fill="none">
          {[0, 60, 120].map((a) => (
            <g key={a} transform={`rotate(${a} 50 50)`}>
              <line x1="50" y1="10" x2="50" y2="90" />
              <polyline points="40,20 50,30 60,20" />
              <polyline points="40,80 50,70 60,80" />
            </g>
          ))}
        </g>
        <circle cx="50" cy="50" r="7" fill={CREAM} />
      </svg>
      {!small && (
        <div className="absolute inset-x-0 bottom-[9%] text-center" style={{ ...script, color: CREAM, fontSize: "min(18px, 4.5vmin)" }}>
          387
        </div>
      )}
    </div>
  );
}

type Card = { id: number; src: string };

function MemoryMatch({ pool, hosts, active, onComplete, onResult }: GameProps) {
  const [ref, { w, h }] = useBox<HTMLDivElement>();
  // 6 pairs, each a different character; pad to at least 3 with hosts if the pool is tiny
  const faces = useMemo(() => {
    const f = pool.slice(0, 6);
    const pad = [...hosts.map((x) => x.img).filter(Boolean), ...pool];
    for (let i = 0; f.length < 3 && pad.length; i++) f.push(pad[i % pad.length]);
    return f;
  }, [pool, hosts]);
  const [deck, setDeck] = useState<Card[]>(() => faces.flatMap((src, k) => [{ id: k * 2, src }, { id: k * 2 + 1, src }]));
  useEffect(() => {
    setDeck((d) => shuffled(d)); // client-only shuffle (no hydration mismatch)
  }, []);
  const [up, setUp] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]); // card ids
  const [moves, setMoves] = useState(0);
  const [peek, setPeek] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [wrong, setWrong] = useState<number[]>([]);
  const [lastMatch, setLastMatch] = useState<number[]>([]);
  const pairs = deck.length / 2;
  const found = matched.length / 2;
  const done = matched.length === deck.length && deck.length > 0;

  // the 1.5 s peek starts when play starts
  useEffect(() => {
    if (!active || peeked) return;
    setPeek(true);
    setPeeked(true);
    const t = setTimeout(() => setPeek(false), 1500);
    return () => clearTimeout(t);
  }, [active, peeked]);
  useEffect(() => {
    if (peeked && !active) setPeek(false);
  }, [active, peeked]);

  useEffect(() => {
    onResult(found === pairs ? `All ${pairs} pairs in ${moves} moves!` : `${found} of ${pairs} pairs!`);
  }, [found, pairs, moves, onResult]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onComplete, 700);
    return () => clearTimeout(t);
  }, [done, onComplete]);

  const flip = (c: Card) => {
    if (!active || peek || done || up.length >= 2 || up.includes(c.id) || matched.includes(c.id)) return;
    sounds.unlock();
    sounds.tap();
    const nextUp = [...up, c.id];
    setUp(nextUp);
    if (nextUp.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = nextUp.map((id) => deck.find((d) => d.id === id)!);
    if (a.src === b.src) {
      setTimeout(() => {
        setMatched((m) => [...m, a.id, b.id]);
        setLastMatch([a.id, b.id]);
        setUp([]);
        sounds.tick();
      }, 280);
    } else {
      setTimeout(() => setWrong(nextUp), 450);
      setTimeout(() => {
        setUp([]);
        setWrong([]);
      }, 950);
    }
  };

  // fit the grid to the box: try every column count, keep the biggest card
  const n = deck.length;
  const gap = Math.max(6, Math.min(w, h) * 0.025);
  const pad = Math.max(8, Math.min(w, h) * 0.03);
  const top = Math.max(34, h * 0.09);
  const RATIO = 0.8; // card w/h
  let best = { cols: 1, rows: n, cw: 0, ch: 0 };
  if (w && h) {
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const availW = w - pad * 2 - gap * (cols - 1);
      const availH = h - top - pad - gap * (rows - 1);
      const cw = Math.min(availW / cols, (availH / rows) * RATIO);
      if (cw > best.cw) best = { cols, rows, cw, ch: cw / RATIO };
    }
  }
  const gridW = best.cols * best.cw + gap * (best.cols - 1);
  const gridH = best.rows * best.ch + gap * (best.rows - 1);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 0%, #fff8ea 0%, ${CREAM} 55%, #f0d9ae 100%)` }} data-testid="memory-area">
      <Snow count={14} />
      <div className="pointer-events-none absolute z-20 flex items-center" style={{ left: u(1), top: u(0.9), gap: u(0.8) }}>
        <div className="rounded-full" style={{ ...pill, fontSize: `max(15px, ${u(1.9)})`, padding: `${u(0.1)} ${u(1.1)}` }} data-testid="memory-moves">
          Moves {moves}
        </div>
        <div className="rounded-full font-bold" style={{ background: RED, color: CREAM, fontSize: `max(11px, ${u(1.2)})`, padding: `${u(0.2)} ${u(1)}` }}>
          {found}/{pairs} pairs
        </div>
        {peek && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-full"
            style={{ ...script, background: PAPER, color: RED, border: `2px solid ${GOLD}`, fontSize: `max(15px, ${u(1.8)})`, padding: `0 ${u(1.2)}` }}
          >
            Remember them!
          </motion.div>
        )}
      </div>

      {best.cw > 0 && (
        <div
          className="absolute grid"
          style={{
            left: (w - gridW) / 2,
            top: top + (h - top - pad - gridH) / 2,
            gridTemplateColumns: `repeat(${best.cols}, ${best.cw}px)`,
            gridAutoRows: `${best.ch}px`,
            gap,
          }}
        >
          {deck.map((c, i) => {
            const isMatched = matched.includes(c.id);
            const faceUp = peek || isMatched || up.includes(c.id);
            return (
              <motion.button
                key={c.id}
                type="button"
                aria-label="card"
                className="relative h-full w-full"
                style={{ perspective: 600 }}
                initial={{ scale: 0, rotate: -10 }}
                animate={
                  wrong.includes(c.id)
                    ? { scale: 1, rotate: 0, x: [0, -6, 6, -4, 0] }
                    : isMatched && lastMatch.includes(c.id)
                      ? { scale: [1, 1.15, 1], rotate: 0, x: 0 }
                      : { scale: 1, rotate: 0, x: 0 }
                }
                transition={{ delay: moves === 0 && !isMatched ? i * 0.03 : 0, duration: 0.35 }}
                whileTap={!faceUp && active ? { scale: 0.93 } : undefined}
                onPointerDown={() => flip(c)}
                data-testid="card"
                data-src={c.src}
                data-up={faceUp ? "1" : "0"}
              >
                <motion.div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }} animate={{ rotateY: faceUp ? 180 : 0 }} transition={{ duration: 0.35 }}>
                  <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                    <CardBack />
                  </div>
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      borderRadius: "12%/10%",
                      background: isMatched ? `linear-gradient(160deg, #fff6dc, #f6dc9c)` : PAPER,
                      border: `3px solid ${isMatched ? GOLD : "#ecd6ac"}`,
                      boxShadow: isMatched ? `0 0 14px ${GOLD}` : "0 4px 8px rgba(60,8,10,0.2)",
                      padding: "8%",
                    }}
                  >
                    <Sticker src={c.src} className="h-full w-full" />
                  </div>
                </motion.div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
