"use client";

/* eslint-disable @next/next/no-img-element -- stickers are data: URLs / blob URLs, next/image can't help */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/booth-sounds";
import { cn } from "@/lib/utils";
import { u } from "../units";

/**
 * Carol Games — four quick mini-games starring the guest's own stickers, played
 * while their sheet prints (387 Christmas Carols). Snowball Toss → Figure-8 Skate →
 * Present Shuffle → Memory Match, each on its own countdown, with a "New stickers
 * unlocked!" flourish in between. Calls onDone() after the last one (or Skip).
 */

const RED = "#a3161c";
const RED_DARK = "#6d0d10";
const CREAM = "#fbefd5";
const PAPER = "#fffaf0";
const GOLD = "#e2b65a";
const INK = "#3b1210";

const UNLOCK_MS = 1200;
const STICKER_SHADOW = "drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 4px 5px rgba(60,8,10,0.35))";

type Host = { name: string; img: string };

export type CarolGamesProps = {
  /** the guest's pose stickers (image srcs); duplicates are fine */
  stickers: string[];
  /** the guest's main cartoon sticker */
  hero: string;
  /** host chibis, for flavor */
  hosts: { name: string; img: string }[];
  /** guest name for captions */
  name: string | null;
  /** total budget for all four games, default 80 s */
  durationMs?: number;
  /** all games finished (or skipped / time ran out) */
  onDone: () => void;
};

type GameProps = {
  pool: string[]; // distinct guest stickers, never empty
  hero: string;
  hosts: Host[];
  name: string | null;
  durationMs: number;
  onComplete: () => void;
  onResult: (r: string) => void;
};

const GAMES: { id: string; title: string; Comp: (p: GameProps) => React.ReactElement }[] = [
  { id: "snow", title: "Snowball Toss", Comp: SnowballToss },
  { id: "skate", title: "Figure-8 Skate", Comp: FigureEight },
  { id: "shuffle", title: "Present Shuffle", Comp: PresentShuffle },
  { id: "memory", title: "Memory Match", Comp: MemoryMatch },
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

/** a little caption pill floating at the top of a game */
function Caption({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-x-0 z-20 flex justify-center", className)}
      style={{ top: u(1) }}
    >
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

const KEYFRAMES = `
@keyframes cg-fall { from { transform: translate3d(0,-20px,0); } to { transform: translate3d(var(--dx,0),110vh,0); } }
@keyframes cg-twinkle { 0%,100% { opacity: .35; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
`;

// ---------------------------------------------------------------- shell

export function CarolGames({ stickers, hero, hosts, name, durationMs = 80000, onDone }: CarolGamesProps) {
  const pool = useMemo(() => {
    const s = Array.from(new Set(stickers.filter(Boolean)));
    return s.length ? s : [hero];
  }, [stickers, hero]);
  const per = Math.max(3000, (durationMs - GAMES.length * UNLOCK_MS) / GAMES.length);
  const last = GAMES.length - 1;

  const [stage, setStage] = useState<{ idx: number; phase: "play" | "unlock" }>({ idx: 0, phase: "play" });
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

  const complete = useCallback((idx: number) => {
    setStage((s) => (s.idx === idx && s.phase === "play" ? { idx, phase: "unlock" } : s));
  }, []);

  // per-stage timers: play → (time up) unlock → next game / done
  useEffect(() => {
    if (doneRef.current) return;
    if (stage.phase === "play") {
      startedAt.current = Date.now();
      const t = setTimeout(() => complete(stage.idx), per);
      return () => clearTimeout(t);
    }
    sounds.success();
    const t = setTimeout(() => {
      if (stage.idx >= last) finishAll();
      else {
        setResult("");
        setStage({ idx: stage.idx + 1, phase: "play" });
      }
    }, UNLOCK_MS);
    return () => clearTimeout(t);
  }, [stage, per, last, complete, finishAll]);

  // safety net: never run past the budget
  useEffect(() => {
    const t = setTimeout(finishAll, durationMs + 2500);
    return () => clearTimeout(t);
  }, [durationMs, finishAll]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const completeCurrent = useCallback(() => complete(stage.idx), [complete, stage.idx]);

  const skip = () => {
    sounds.tap();
    if (stage.idx >= last) finishAll();
    else {
      setResult("");
      setStage({ idx: stage.idx + 1, phase: "play" });
    }
  };

  const game = GAMES[stage.idx];
  const Game = game.Comp;
  const secsLeft = now && stage.phase === "play" ? Math.max(0, Math.ceil((startedAt.current + per - now) / 1000)) : null;
  const hurry = secsLeft !== null && secsLeft <= 3;

  // 1–3 of the guest's stickers to "unlock" after each game
  const unlocked = useMemo(() => {
    const n = Math.min(3, pool.length);
    return Array.from({ length: n }, (_, k) => pool[(stage.idx * 3 + k) % pool.length]);
  }, [pool, stage.idx]);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ color: INK }}>
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
            Game {stage.idx + 1} of {GAMES.length}
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
          {secsLeft !== null && (
            <motion.span
              key={hurry ? secsLeft : "calm"}
              initial={hurry ? { scale: 1.5 } : false}
              animate={{ scale: 1 }}
              className="shrink-0 tabular-nums"
              style={{ ...comic, color: hurry ? RED : INK, fontSize: `max(17px, ${u(2.2)})` }}
            >
              {secsLeft}s
            </motion.span>
          )}
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

        {/* this game's countdown */}
        <div
          className="relative w-full overflow-hidden rounded-full"
          style={{ height: `max(10px, ${u(1.1)})`, background: "rgba(163,22,28,0.14)", boxShadow: "inset 0 1px 2px rgba(60,8,10,0.25)" }}
        >
          <motion.div
            key={`${stage.idx}-${stage.phase}`}
            data-testid="game-bar"
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: hurry
                ? `linear-gradient(90deg, #d32f2f, ${RED})`
                : `repeating-linear-gradient(-45deg, ${GOLD} 0 10px, #f0cf83 10px 20px)`,
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.12)",
            }}
            initial={{ width: stage.phase === "play" ? "100%" : "0%" }}
            animate={{ width: "0%" }}
            transition={{ duration: stage.phase === "play" ? per / 1000 : 0, ease: "linear" }}
          />
        </div>

        {/* overall progress: one segment per game */}
        <div className="flex w-full" style={{ gap: u(0.5) }}>
          {GAMES.map((g, i) => (
            <div
              key={g.id}
              className="relative flex-1 overflow-hidden rounded-full"
              style={{ height: `max(4px, ${u(0.45)})`, background: "rgba(163,22,28,0.14)" }}
            >
              {i < stage.idx || (i === stage.idx && stage.phase === "unlock") ? (
                <div className="absolute inset-0" style={{ background: RED }} />
              ) : i === stage.idx ? (
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
          <Game
            key={game.id}
            pool={pool}
            hero={hero}
            hosts={hosts}
            name={name}
            durationMs={per}
            onComplete={completeCurrent}
            onResult={setResult}
          />
        </div>

        {/* between games: "New stickers unlocked!" */}
        <AnimatePresence>
          {stage.phase === "unlock" && (
            <motion.div
              key={`unlock-${stage.idx}`}
              data-testid="unlock"
              className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden"
              style={{
                borderRadius: u(2.2),
                background: `radial-gradient(circle at 50% 45%, #c0262c 0%, ${RED} 45%, ${RED_DARK} 100%)`,
                gap: u(1.2),
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <Snow count={18} />
              <Sparkles />
              <motion.div
                initial={{ y: -20, scale: 0.6 }}
                animate={{ y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 16 }}
                className="relative px-4 text-center"
                style={{ ...script, color: CREAM, fontSize: `max(24px, ${u(3.6)})`, lineHeight: 1.05, textShadow: `0 3px 0 ${RED_DARK}` }}
              >
                New stickers unlocked!
              </motion.div>
              <div className="relative flex items-end justify-center" style={{ gap: u(1.4) }}>
                {unlocked.map((src, k) => (
                  <motion.div
                    key={k}
                    initial={{ scale: 0, rotate: -30, y: 30 }}
                    animate={{ scale: 1, rotate: [-8, 6, -4][k] ?? 0, y: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 13, delay: 0.12 + k * 0.13 }}
                    className="rounded-[18%]"
                    style={{
                      width: `min(${u(13)}, 26vw, 24vh)`,
                      height: `min(${u(13)}, 26vw, 24vh)`,
                      background: "rgba(255,250,240,0.16)",
                      boxShadow: `0 0 0 2px ${GOLD}`,
                      padding: u(0.6),
                    }}
                  >
                    <Sticker src={src} className="h-full w-full" />
                  </motion.div>
                ))}
              </div>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="relative rounded-full"
                  style={{ ...comic, background: "#ffe36e", color: "#1a1a1a", border: "2px solid #1a1a1a", fontSize: `max(15px, ${u(1.9)})`, padding: `${u(0.2)} ${u(1.4)}` }}
                >
                  {result}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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

// ---------------------------------------------------------------- 1. Snowball Toss

type Pop = { id: number; hole: number; src: string; bonus: boolean; until: number; hit: boolean };
type Ball = { id: number; x0: number; y0: number; x: number; y: number };
type Pow = { id: number; x: number; y: number; text: string; bonus: boolean; hit: boolean };

const POWS = ["POW!", "SPLAT!", "BAM!", "WHAM!", "BOOF!"];

function SnowballToss({ pool, hosts, name, onResult }: GameProps) {
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
  const [hint, setHint] = useState(true);
  const nextId = useRef(1);

  useEffect(() => {
    onResult(`${score} snowball ${score === 1 ? "hit" : "hits"}`);
  }, [score, onResult]);

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 3200);
    return () => clearTimeout(t);
  }, []);

  // spawner
  useEffect(() => {
    if (!holes) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const spawn = () => {
      if (!alive) return;
      const now = Date.now();
      setPops((cur) => {
        const live = cur.filter((p) => p.until > now);
        if (live.filter((p) => !p.hit).length >= 2) return live;
        const free = Array.from({ length: holes }, (_, i) => i).filter((i) => !live.some((p) => p.hole === i));
        if (!free.length) return live;
        const bonus = hosts.length > 0 && Math.random() < 0.14;
        return [
          ...live,
          {
            id: nextId.current++,
            hole: pick(free),
            src: bonus ? pick(hosts).img : pick(pool),
            bonus,
            until: now + rnd(800, 1200),
            hit: false,
          },
        ];
      });
      timer = setTimeout(spawn, rnd(380, 700));
    };
    timer = setTimeout(spawn, 350);
    const sweep = setInterval(() => {
      const now = Date.now();
      setPops((cur) => (cur.some((p) => p.until <= now) ? cur.filter((p) => p.until > now) : cur));
    }, 100);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(sweep);
    };
  }, [holes, pool, hosts]);

  const holeCenter = (hole: number) => {
    const c = hole % cols;
    const r = Math.floor(hole / cols);
    const cx = cellW * (c + 0.5);
    const bankTop = topPad + cellH * (r + 1) - cellH * 0.06 - bankH;
    return { cx, cy: bankTop + bankH * 0.45 - S * 0.5, bankTop };
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    sounds.unlock();
    setHint(false);
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
      if (d < S * 0.62 && d < best) {
        best = d;
        target = p;
      }
    }
    const ball: Ball = { id: nextId.current++, x0: w / 2, y0: h + 10, x, y };
    setBalls((b) => [...b, ball]);
    setTimeout(() => setBalls((b) => b.filter((q) => q.id !== ball.id)), 320);
    sounds.tap();
    if (target) {
      const pts = target.bonus ? 3 : 1;
      const tid = target.id;
      setPops((cur) => cur.map((p) => (p.id === tid ? { ...p, hit: true, until: Date.now() + 850 } : p)));
      setScore((s) => s + pts);
      setTimeout(() => {
        setBump((b) => b + 1);
        if (target.bonus) sounds.success();
        else sounds.tick();
      }, 260);
    }
    const pow: Pow = { id: nextId.current++, x, y, text: target ? (target.bonus ? "+3!" : pick(POWS)) : "poof", bonus: !!target?.bonus, hit: !!target };
    setTimeout(() => setPows((p) => [...p, pow]), 260);
    setTimeout(() => setPows((p) => p.filter((q) => q.id !== pow.id)), 1000);
  };

  return (
    <div
      ref={ref}
      className="absolute inset-0 touch-none overflow-hidden"
      style={{ background: "linear-gradient(180deg, #2a1a3e 0%, #5a2a4a 38%, #f3d6c0 78%, #fff6ea 100%)" }}
      onPointerDown={onDown}
      data-testid="snow-area"
    >
      {/* night sky, stars and a moon */}
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
              {/* sticker window: clipped so stickers rise from behind the bank */}
              <div
                className="pointer-events-none absolute overflow-hidden"
                style={{ left: cx - S * 0.6, width: S * 1.2, top: winBottom - S * 1.15, height: S * 1.15 }}
              >
                <AnimatePresence>
                  {pop && (
                    <motion.div
                      key={pop.id}
                      className="absolute bottom-0 left-1/2"
                      style={{ width: S, height: S, marginLeft: -S / 2 }}
                      initial={{ y: S }}
                      animate={{ y: S * 0.04 }}
                      exit={{ y: S, transition: { duration: 0.16 } }}
                      transition={{ type: "spring", stiffness: 520, damping: 20 }}
                    >
                      <motion.div
                        className="h-full w-full"
                        style={{ transformOrigin: "50% 90%" }}
                        animate={
                          pop.hit
                            ? { rotate: [0, -18, 14, -10, 6, 0], scale: [1, 0.86, 1.06, 0.96, 1], transition: { delay: 0.25, duration: 0.55 } }
                            : { rotate: [0, -3, 3, 0], transition: { duration: 0.6, repeat: Infinity } }
                        }
                      >
                        <Sticker
                          src={pop.src}
                          className="h-full w-full"
                          style={pop.bonus ? { filter: `${STICKER_SHADOW} drop-shadow(0 0 8px ${GOLD})` } : undefined}
                        />
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
                      {pop.bonus && !pop.hit && (
                        <div
                          className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
                          style={{ ...comic, background: GOLD, color: INK, fontSize: Math.max(12, S * 0.14), padding: "0 6px", border: "2px solid #fff" }}
                        >
                          +3
                        </div>
                      )}
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
            className="pointer-events-none absolute left-0 top-0 rounded-full"
            style={{
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              background: "radial-gradient(circle at 35% 30%, #fff 0%, #f3f7fb 50%, #c9d8e8 100%)",
              boxShadow: "0 2px 6px rgba(40,40,80,0.35)",
            }}
            initial={{ x: b.x0, y: b.y0, scale: 1.7 }}
            animate={{ x: [b.x0, (b.x0 + b.x) / 2, b.x], y: [b.y0, midY, b.y], scale: [1.7, 1.1, 0.75] }}
            transition={{ duration: 0.27, ease: "easeOut" }}
          />
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
              {p.hit ? (
                <Burst text={p.text} size={size} color={p.bonus ? GOLD : "#ffe36e"} />
              ) : (
                <div className="relative" style={{ width: size, height: size }}>
                  {Array.from({ length: 7 }, (_, i) => (
                    <span
                      key={i}
                      className="absolute rounded-full bg-white"
                      style={{
                        width: size * 0.22,
                        height: size * 0.22,
                        left: size / 2 + Math.cos(i) * size * 0.32 - size * 0.11,
                        top: size / 2 + Math.sin(i) * size * 0.32 - size * 0.11,
                        boxShadow: "0 1px 3px rgba(60,60,100,0.4)",
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* score */}
      <motion.div
        key={bump}
        className="pointer-events-none absolute z-20 flex items-center rounded-full"
        style={{
          left: u(1),
          top: u(1),
          ...comic,
          background: "#ffe36e",
          color: "#1a1a1a",
          border: "2px solid #1a1a1a",
          boxShadow: "3px 3px 0 #1a1a1a",
          fontSize: `max(17px, ${u(2.1)})`,
          padding: `${u(0.1)} ${u(1.2)}`,
        }}
        initial={{ scale: bump ? 1.45 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
        data-testid="snow-score"
      >
        ❄ {score}
      </motion.div>

      <AnimatePresence>
        {hint && (
          <motion.div exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0">
            <Caption className="!top-auto bottom-[6%]">Tap {name ? `${name}'s` : "your"} stickers to throw snowballs!</Caption>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- 2. Figure-8 Skate

const N_PTS = 360;
const BINS = 36;

function FigureEight({ pool, hero, name, onComplete, onResult }: GameProps) {
  const [ref, { w, h }] = useBox<HTMLDivElement>();
  const skater = pool.length > 1 ? pool[1] : hero;

  const geo = useMemo(() => {
    if (!w || !h) return null;
    const land = w >= h;
    const cx = w / 2;
    const cy = h / 2 + (land ? h * 0.03 : h * 0.02);
    const A = land ? Math.min(w * 0.37, h * 1.05) : w * 0.34;
    const B = land ? h * 0.33 : Math.min(h * 0.36, w * 1.05);
    const pts = Array.from({ length: N_PTS }, (_, i) => {
      const t = (i / N_PTS) * Math.PI * 2;
      return land ? { x: cx + A * Math.sin(t), y: cy + B * Math.sin(2 * t) } : { x: cx + A * Math.sin(2 * t), y: cy + B * Math.sin(t) };
    });
    const d = "M" + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L") + "Z";
    const per = N_PTS / BINS;
    const bins = Array.from({ length: BINS }, (_, b) => {
      const seg = pts.slice(b * per, b * per + per + 1);
      if (b === BINS - 1) seg.push(pts[0]);
      return "M" + seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L");
    });
    const tol = Math.max(24, Math.min(w, h) * 0.085);
    const start = pts[N_PTS / 4];
    const ghost = pts.filter((_, i) => i % 6 === 0);
    ghost.push(pts[0]);
    // start the ghost at the start marker
    const rot = ghost.slice(N_PTS / 4 / 6).concat(ghost.slice(1, N_PTS / 4 / 6 + 1));
    return { pts, d, bins, tol, start, ghost: rot, S: Math.max(58, Math.min(w, h) * 0.22) };
  }, [w, h]);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [visited, setVisited] = useState<boolean[]>(() => Array(BINS).fill(false));
  const [acc, setAcc] = useState<number | null>(null);
  const [off, setOff] = useState(0);
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const dragging = useRef(false);
  const counts = useRef({ on: 0, total: 0 });
  const lastSample = useRef<{ x: number; y: number } | null>(null);
  const offTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOffSound = useRef(0);

  useEffect(() => {
    onResult(acc === null ? "Keep skating!" : `Accuracy ${acc}%`);
  }, [acc, onResult]);

  useEffect(() => {
    if (!done) return;
    sounds.success();
    const t = setTimeout(onComplete, 1700);
    return () => clearTimeout(t);
  }, [done, onComplete]);

  useEffect(() => () => {
    if (offTimer.current) clearTimeout(offTimer.current);
  }, []);

  const sample = (x: number, y: number) => {
    if (!geo || done) return;
    setPos({ x, y });
    // sub-sample long moves so fast swipes are scored fairly
    const prev = lastSample.current;
    const steps = prev ? Math.max(1, Math.min(12, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / (geo.tol * 0.5)))) : 1;
    let next = visited;
    let changed = false;
    let anyOff = false;
    for (let s = 1; s <= steps; s++) {
      const qx = prev ? prev.x + ((x - prev.x) * s) / steps : x;
      const qy = prev ? prev.y + ((y - prev.y) * s) / steps : y;
      let bestD = Infinity;
      let bestI = 0;
      for (let i = 0; i < N_PTS; i++) {
        const p = geo.pts[i];
        const d = (p.x - qx) ** 2 + (p.y - qy) ** 2;
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
      const on = Math.sqrt(bestD) <= geo.tol;
      counts.current.total += 1;
      if (on) {
        counts.current.on += 1;
        const b = Math.floor(bestI / (N_PTS / BINS));
        if (!next[b]) {
          if (!changed) next = next.slice();
          next[b] = true;
          changed = true;
        }
      } else anyOff = true;
    }
    lastSample.current = { x, y };
    const pct = Math.round((counts.current.on / counts.current.total) * 100);
    setAcc(pct);
    if (changed) {
      setVisited(next);
      if (next.filter(Boolean).length >= BINS * 0.92) {
        dragging.current = false;
        setDone(true);
      }
    }
    if (anyOff) {
      setOff((o) => o + 1);
      if (offTimer.current) clearTimeout(offTimer.current);
      offTimer.current = setTimeout(() => setOff(0), 260);
      if (Date.now() - lastOffSound.current > 400) {
        lastOffSound.current = Date.now();
        sounds.tap();
      }
    }
  };

  const local = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const covered = visited.filter(Boolean).length;
  const skaterAt = pos ?? geo?.start;
  const S = geo?.S ?? 60;

  return (
    <div
      ref={ref}
      className="absolute inset-0 touch-none overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.9) 0%, transparent 45%), radial-gradient(ellipse at 75% 85%, rgba(255,255,255,0.7) 0%, transparent 40%), linear-gradient(160deg, #e9f6fd 0%, #cfe9f7 55%, #b9dcf0 100%)",
      }}
      onPointerDown={(e) => {
        sounds.unlock();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        lastSample.current = null;
        setTouched(true);
        const q = local(e);
        sample(q.x, q.y);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const q = local(e);
        sample(q.x, q.y);
      }}
      onPointerUp={() => {
        dragging.current = false;
        lastSample.current = null;
      }}
      onPointerCancel={() => {
        dragging.current = false;
        lastSample.current = null;
      }}
      data-testid="skate-area"
    >
      {/* rink markings */}
      <div className="pointer-events-none absolute inset-0" style={{ border: "6px solid rgba(163,22,28,0.25)", borderRadius: "inherit" }} />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2" style={{ background: "rgba(163,22,28,0.18)" }} />
      <Snow count={14} />

      {geo && (
        <svg className="pointer-events-none absolute inset-0" width={w} height={h}>
          {/* the lane */}
          <path d={geo.d} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={geo.tol * 2} strokeLinejoin="round" />
          <path d={geo.d} fill="none" stroke="rgba(80,150,200,0.25)" strokeWidth={geo.tol * 2} strokeLinejoin="round" strokeDasharray="1 0" opacity={0.35} />
          {/* traced so far */}
          {geo.bins.map((bd, i) => (
            <path key={i} d={bd} fill="none" stroke={visited[i] ? GOLD : "transparent"} strokeWidth={Math.max(8, geo.tol * 0.7)} strokeLinecap="round" />
          ))}
          {/* center line */}
          <path d={geo.d} fill="none" stroke="#3d7fb0" strokeWidth={3} strokeDasharray="10 9" strokeLinecap="round" />
          {/* start flag */}
          <g transform={`translate(${geo.start.x},${geo.start.y})`}>
            <circle r={geo.tol * 0.55} fill={RED} stroke="#fff" strokeWidth={3} />
            <text y={4} textAnchor="middle" fontSize={Math.max(10, geo.tol * 0.42)} fill="#fff" fontWeight={800}>
              GO
            </text>
          </g>
        </svg>
      )}

      {/* ghost guide until they start */}
      {geo && !touched && (
        <motion.div
          className="pointer-events-none absolute left-0 top-0 rounded-full"
          style={{ width: 26, height: 26, marginLeft: -13, marginTop: -13, background: GOLD, boxShadow: `0 0 0 6px rgba(226,182,90,0.35), 0 0 16px ${GOLD}` }}
          animate={{ x: geo.ghost.map((p) => p.x), y: geo.ghost.map((p) => p.y) }}
          transition={{ duration: 4.2, ease: "linear", repeat: Infinity }}
        />
      )}

      {/* off-track flash */}
      <AnimatePresence>
        {off > 0 && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-10"
            style={{ boxShadow: "inset 0 0 0 8px rgba(211,47,47,0.85), inset 0 0 40px rgba(211,47,47,0.55)", borderRadius: "inherit" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          />
        )}
      </AnimatePresence>

      {/* the skater: bottom-center (skates) sits on the finger */}
      {skaterAt && (
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-10"
          style={{ width: S, height: S, x: skaterAt.x - S / 2, y: skaterAt.y - S * 0.95 }}
          animate={off ? { rotate: [0, -14, 12, -6, 0] } : { rotate: pos ? [-6, 6] : [0, 0] }}
          transition={off ? { duration: 0.3 } : { duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
        >
          <Sticker src={skater} className="h-full w-full" style={off ? { filter: `${STICKER_SHADOW} drop-shadow(0 0 6px #d32f2f)` } : undefined} />
        </motion.div>
      )}
      {pos && (
        <div
          className="pointer-events-none absolute z-10 rounded-full"
          style={{ left: pos.x - 7, top: pos.y - 7, width: 14, height: 14, background: off ? "#d32f2f" : "#fff", border: `3px solid ${off ? "#fff" : "#3d7fb0"}` }}
        />
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute z-20 flex flex-col items-start" style={{ left: u(1), top: u(1), gap: u(0.4) }}>
        <motion.div
          className="rounded-full"
          style={{ ...comic, background: "#ffe36e", color: "#1a1a1a", border: "2px solid #1a1a1a", boxShadow: "3px 3px 0 #1a1a1a", fontSize: `max(16px, ${u(2)})`, padding: `${u(0.1)} ${u(1.2)}` }}
          animate={off ? { x: [0, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: 0.2 }}
          data-testid="skate-acc"
        >
          {acc === null ? "Accuracy –" : `Accuracy ${acc}%`}
        </motion.div>
        <div
          className="rounded-full font-bold"
          style={{ background: "rgba(255,255,255,0.85)", color: "#3d7fb0", fontSize: `max(11px, ${u(1.2)})`, padding: `${u(0.1)} ${u(1)}` }}
        >
          Loop {Math.round((covered / BINS) * 100)}%
        </div>
      </div>

      {!touched && <Caption className="!top-auto bottom-[5%]">Drag {name ? `${name}` : "your skater"} along the figure-8!</Caption>}

      <AnimatePresence>
        {done && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ background: "rgba(255,250,240,0.55)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              initial={{ scale: 0.3, rotate: -12 }}
              animate={{ scale: 1, rotate: -4 }}
              transition={{ type: "spring", stiffness: 480, damping: 12 }}
              className="rounded-[20px] text-center"
              style={{ ...script, background: RED, color: CREAM, border: `3px solid ${GOLD}`, fontSize: `max(28px, ${u(4.4)})`, padding: `${u(1)} ${u(3)}`, boxShadow: "0 8px 20px rgba(60,8,10,0.4)" }}
              data-testid="skate-done"
            >
              Accuracy {acc ?? 0}%!
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- 3. Present Shuffle

type ShufflePhase = "show" | "hide" | "shuffle" | "pick" | "reveal";

function PresentBox({ P, lit }: { P: number; lit?: boolean }) {
  const bodyH = P * 0.74;
  const lidH = P * 0.2;
  return (
    <div className="relative" style={{ width: P, height: P * 1.14 }}>
      {/* bow */}
      <div className="absolute left-1/2" style={{ top: 0, width: P * 0.5, height: P * 0.22, marginLeft: -P * 0.25 }}>
        <div className="absolute rounded-[50%]" style={{ left: 0, top: P * 0.02, width: P * 0.26, height: P * 0.18, border: `${P * 0.045}px solid ${GOLD}`, transform: "rotate(-18deg)" }} />
        <div className="absolute rounded-[50%]" style={{ right: 0, top: P * 0.02, width: P * 0.26, height: P * 0.18, border: `${P * 0.045}px solid ${GOLD}`, transform: "rotate(18deg)" }} />
        <div className="absolute left-1/2 rounded-full" style={{ bottom: -P * 0.02, width: P * 0.12, height: P * 0.1, marginLeft: -P * 0.06, background: "#c99a3d" }} />
      </div>
      {/* lid */}
      <div
        className="absolute left-1/2"
        style={{
          top: P * 0.2,
          width: P * 1.06,
          marginLeft: -P * 0.53,
          height: lidH,
          borderRadius: P * 0.05,
          background: `linear-gradient(180deg, #c0262c, ${RED_DARK})`,
          boxShadow: "0 3px 0 rgba(0,0,0,0.18)",
        }}
      >
        <div className="absolute inset-y-0 left-1/2" style={{ width: P * 0.16, marginLeft: -P * 0.08, background: `linear-gradient(90deg, #c99a3d, ${GOLD}, #f3d58c, ${GOLD})` }} />
      </div>
      {/* body */}
      <div
        className="absolute bottom-0 left-0 overflow-hidden"
        style={{
          width: P,
          height: bodyH,
          borderRadius: `${P * 0.03}px ${P * 0.03}px ${P * 0.07}px ${P * 0.07}px`,
          background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18) 0 ${P * 0.05}px, transparent ${P * 0.06}px) 0 0 / ${P * 0.25}px ${P * 0.25}px, linear-gradient(180deg, ${RED}, #7d0f14)`,
          boxShadow: lit ? `0 0 0 4px ${GOLD}, 0 0 24px ${GOLD}` : "inset 0 -6px 0 rgba(0,0,0,0.18)",
        }}
      >
        <div className="absolute inset-y-0 left-1/2" style={{ width: P * 0.16, marginLeft: -P * 0.08, background: `linear-gradient(90deg, #c99a3d, ${GOLD}, #f3d58c, ${GOLD})` }} />
      </div>
    </div>
  );
}

function PresentShuffle({ hero, name, durationMs, onComplete, onResult }: GameProps) {
  const [ref, { w, h }] = useBox<HTMLDivElement>();
  const startedAt = useRef(0);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<ShufflePhase>("show");
  const [slotOf, setSlotOf] = useState([0, 1, 2]);
  const slotRef = useRef([0, 1, 2]);
  const [heroIn, setHeroIn] = useState(1);
  const [swap, setSwap] = useState<{ n: number; a: number; b: number; dur: number }>({ n: 0, a: -1, b: -1, dur: 0.4 });
  const [picked, setPicked] = useState<number | null>(null);
  const [wins, setWins] = useState(0);
  const [played, setPlayed] = useState(0);

  useEffect(() => {
    startedAt.current = Date.now();
    setRound(1);
  }, []);

  useEffect(() => {
    onResult(played ? `Found ${wins} of ${played}` : "Keep watching!");
  }, [wins, played, onResult]);

  // one round: show → hide → shuffle (5–7 swaps, speeding up) → pick
  useEffect(() => {
    if (!round) return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => alive && fn(), ms));
    setPicked(null);
    setHeroIn(Math.floor(Math.random() * 3));
    setPhase("show");
    at(1300, () => setPhase("hide"));
    const swaps = round === 1 ? 5 + Math.floor(Math.random() * 2) : 7;
    let t = 1300 + 650;
    at(t - 100, () => setPhase("shuffle"));
    for (let i = 0; i < swaps; i++) {
      const k = i / Math.max(1, swaps - 1);
      const dur = (round === 1 ? 0.5 : 0.4) - k * (round === 1 ? 0.24 : 0.2);
      at(t, () => {
        const sa = Math.floor(Math.random() * 3);
        const sb = (sa + 1 + Math.floor(Math.random() * 2)) % 3;
        const cur = slotRef.current;
        const a = cur.indexOf(sa);
        const b = cur.indexOf(sb);
        const next = cur.slice();
        next[a] = sb;
        next[b] = sa;
        slotRef.current = next;
        setSlotOf(next);
        setSwap((s) => ({ n: s.n + 1, a, b, dur }));
        sounds.tap();
      });
      t += dur * 1000 + 70;
    }
    at(t + 200, () => setPhase("pick"));
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [round]);

  // after the reveal: another round if there's time, else done
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = setTimeout(() => {
      const left = startedAt.current + durationMs - Date.now();
      if (round < 2 && left > 7500) setRound((r) => r + 1);
      else onComplete();
    }, 1900);
    return () => clearTimeout(t);
  }, [phase, round, durationMs, onComplete]);

  const choose = (id: number) => {
    if (phase !== "pick") return;
    sounds.unlock();
    setPicked(id);
    setPhase("reveal");
    setPlayed((p) => p + 1);
    if (id === heroIn) {
      setWins((x) => x + 1);
      sounds.success();
    } else sounds.tick();
  };

  const P = Math.min(w * 0.3, h * 0.4);
  const spacing = Math.min(w * 0.335, P * 1.45);
  const baseY = Math.min(h - Math.max(P * 0.3, 18), h * 0.5 + P * 1.1); // bottom of the presents
  // lift far enough to show the hero, but keep the lifted present inside the box
  const lift = Math.max(P * 0.85, Math.min(P * 1.02, baseY - P * 2.16 + P * 1.02 - 4));
  const slotX = (s: number) => w / 2 + (s - 1) * spacing;
  const heroS = P * 0.92;
  const found = picked !== null && picked === heroIn;

  const caption =
    phase === "show" || phase === "hide"
      ? `Watch ${name ?? "yourself"} hide…`
      : phase === "shuffle"
        ? "Keep your eye on the present!"
        : phase === "pick"
          ? `Where's ${name ?? "your sticker"}? Tap a present!`
          : found
            ? "Found you!"
            : "Nope!";

  return (
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 50% 30%, #fff8ea 0%, ${CREAM} 45%, #f0d9ae 100%)` }}
      data-testid="shuffle-area"
      data-phase={phase}
      data-hero={heroIn}
    >
      {/* string lights */}
      <svg className="pointer-events-none absolute left-0 top-0" width={w} height={Math.max(30, h * 0.12)} aria-hidden>
        <path d={`M0,8 Q${w / 4},${h * 0.09} ${w / 2},10 T${w},8`} stroke="#5a3a2a" strokeWidth={2} fill="none" />
        {Array.from({ length: 11 }, (_, i) => {
          const x = (w / 10) * i;
          const y = 8 + Math.abs(Math.sin((i / 10) * Math.PI * 2)) * h * 0.04 + 6;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={5}
              fill={[GOLD, "#d32f2f", "#3f8f4f"][i % 3]}
              style={{ animation: `cg-twinkle ${1 + (i % 3) * 0.4}s ease-in-out ${i * 0.15}s infinite`, transformOrigin: `${x}px ${y}px` }}
            />
          );
        })}
      </svg>
      {/* table cloth */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ top: baseY - P * 0.12, background: `linear-gradient(180deg, #8c1218, ${RED_DARK})`, boxShadow: "inset 0 6px 0 rgba(255,255,255,0.12)" }}
      >
        <div className="absolute inset-x-0 top-0 h-[6px]" style={{ background: `repeating-linear-gradient(90deg, ${GOLD} 0 14px, transparent 14px 22px)` }} />
      </div>
      <Snow count={14} />

      {w > 0 &&
        [0, 1, 2].map((id) => {
          const lifted = (phase === "show" && id === heroIn) || (phase === "reveal" && (id === picked || id === heroIn));
          const moving = phase === "shuffle" && (id === swap.a || id === swap.b);
          const goesUp = id === swap.a;
          return (
            <motion.div
              key={id}
              className="absolute left-0 top-0"
              style={{ width: P, height: P * 1.14, y: baseY - P * 1.14, zIndex: moving && !goesUp ? 6 : 5 }}
              initial={{ x: slotX(slotOf[id]) - P / 2 }}
              animate={{ x: slotX(slotOf[id]) - P / 2 }}
              transition={{ duration: swap.dur, ease: "easeInOut" }}
            >
              <motion.div
                key={moving ? `m${swap.n}` : "still"}
                className="relative h-full w-full"
                initial={{ y: 0, scale: 1 }}
                animate={moving ? { y: [0, goesUp ? -P * 0.32 : P * 0.12, 0], scale: [1, goesUp ? 0.9 : 1.08, 1] } : { y: 0, scale: 1 }}
                transition={{ duration: swap.dur, ease: "easeInOut" }}
              >
                {/* floor shadow */}
                <div className="absolute left-1/2 rounded-[50%]" style={{ bottom: -P * 0.06, width: P * 1.1, height: P * 0.16, marginLeft: -P * 0.55, background: "rgba(40,5,6,0.35)" }} />
                {/* what's under it */}
                {id === heroIn ? (
                  <motion.div
                    className="absolute bottom-0 left-1/2"
                    style={{ width: heroS, height: heroS, marginLeft: -heroS / 2 }}
                    initial={phase === "show" ? { y: -h * 0.4, opacity: 0 } : false}
                    animate={{ y: 0, opacity: 1, scale: phase === "reveal" && found ? [1, 1.2, 1] : 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 16, scale: { duration: 0.5, delay: 0.2 } }}
                  >
                    <Sticker src={hero} className="h-full w-full" />
                  </motion.div>
                ) : (
                  <div className="absolute bottom-[4%] left-1/2 flex -translate-x-1/2 items-end" style={{ gap: 2 }}>
                    {[0.2, 0.26, 0.18].map((s, i) => (
                      <span key={i} className="rounded-[45%]" style={{ width: P * s, height: P * s * 0.8, background: "radial-gradient(circle at 35% 30%, #555 0%, #1d1d1d 70%)" }} />
                    ))}
                  </div>
                )}
                {/* the present (lifts to reveal) */}
                <motion.button
                  type="button"
                  aria-label={`Present ${id + 1}`}
                  className="absolute inset-0"
                  style={{ cursor: phase === "pick" ? "pointer" : "default" }}
                  animate={{
                    y: lifted ? -lift : 0,
                    rotate: lifted ? (id % 2 ? 5 : -5) : phase === "pick" ? [0, -2, 2, 0] : 0,
                  }}
                  transition={
                    lifted
                      ? { type: "spring", stiffness: 260, damping: 15 }
                      : phase === "pick"
                        ? { duration: 0.8, repeat: Infinity, delay: id * 0.15 }
                        : { type: "spring", stiffness: 380, damping: 24 }
                  }
                  whileTap={phase === "pick" ? { scale: 0.92 } : undefined}
                  onPointerDown={() => choose(id)}
                  data-testid={`present-${id}`}
                >
                  <PresentBox P={P} lit={phase === "reveal" && id === heroIn} />
                </motion.button>
              </motion.div>
            </motion.div>
          );
        })}

      <Caption>{caption}</Caption>

      <AnimatePresence>
        {phase === "reveal" && (
          <motion.div
            key={`r${round}`}
            className="pointer-events-none absolute z-20"
            style={{ left: (picked !== null ? slotX(slotOf[picked]) : w / 2) - Math.max(80, P * 0.85) / 2, top: Math.max(4, baseY - P * 2.55) }}
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: found ? -6 : 6 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 13, delay: 0.15 }}
          >
            <Burst text={found ? "YES!" : "NOPE!"} size={Math.max(80, P * 0.85)} color={found ? "#ffe36e" : "#cfe3f3"} />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="pointer-events-none absolute z-20 rounded-full"
        style={{ left: u(1), bottom: u(1), ...comic, background: "#ffe36e", color: "#1a1a1a", border: "2px solid #1a1a1a", boxShadow: "3px 3px 0 #1a1a1a", fontSize: `max(15px, ${u(1.9)})`, padding: `${u(0.1)} ${u(1.1)}` }}
      >
        Round {Math.max(1, round)} · Found {wins}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 4. Memory Match

function CardBack() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        borderRadius: "12%/10%",
        background: `radial-gradient(circle, rgba(255,255,255,0.12) 1.5px, transparent 2px) 0 0 / 14px 14px, linear-gradient(150deg, #c0262c 0%, ${RED} 50%, ${RED_DARK} 100%)`,
        border: `3px solid ${CREAM}`,
        boxShadow: "0 4px 8px rgba(60,8,10,0.3)",
      }}
    >
      <div className="absolute inset-[7%]" style={{ border: `2px solid ${GOLD}`, borderRadius: "10%/8%" }} />
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
      <div className="absolute inset-x-0 bottom-[9%] text-center" style={{ ...script, color: CREAM, fontSize: "min(18px, 4.5vmin)" }}>
        387
      </div>
    </div>
  );
}

type Card = { id: number; key: number; src: string };

function MemoryMatch({ pool, hero, hosts, onComplete, onResult }: GameProps) {
  const [ref, { w, h }] = useBox<HTMLDivElement>();
  const faces = useMemo(() => Array.from(new Set([...pool, hero, ...hosts.map((x) => x.img)].filter(Boolean))).slice(0, 6), [pool, hero, hosts]);
  const [deck] = useState<Card[]>(() =>
    shuffled(faces.flatMap((src, key) => [{ id: key * 2, key, src }, { id: key * 2 + 1, key, src }]))
  );
  const [up, setUp] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [peek, setPeek] = useState(true);
  const [wrong, setWrong] = useState<number[]>([]);
  const [lastMatch, setLastMatch] = useState(-1);
  const pairs = faces.length;
  const done = matched.length === pairs && pairs > 0;

  useEffect(() => {
    const t = setTimeout(() => setPeek(false), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    onResult(`${matched.length} of ${pairs} pairs · ${moves} moves`);
  }, [matched.length, pairs, moves, onResult]);

  useEffect(() => {
    if (!done) return;
    sounds.success();
    const t = setTimeout(onComplete, 1600);
    return () => clearTimeout(t);
  }, [done, onComplete]);

  const flip = (c: Card) => {
    if (peek || done || up.length >= 2 || up.includes(c.id) || matched.includes(c.key)) return;
    sounds.unlock();
    sounds.tap();
    const nextUp = [...up, c.id];
    setUp(nextUp);
    if (nextUp.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = nextUp.map((id) => deck.find((d) => d.id === id)!);
    if (a.key === b.key) {
      setTimeout(() => {
        setMatched((m) => [...m, a.key]);
        setLastMatch(a.key);
        setUp([]);
        sounds.tick();
      }, 280);
    } else {
      setTimeout(() => setWrong(nextUp), 450);
      setTimeout(() => {
        setUp([]);
        setWrong([]);
      }, 900);
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
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 50% 0%, #fff8ea 0%, ${CREAM} 55%, #f0d9ae 100%)` }}
      data-testid="memory-area"
    >
      <Snow count={14} />
      <div className="pointer-events-none absolute z-20 flex items-center" style={{ left: u(1), top: u(0.9), gap: u(0.8) }}>
        <div
          className="rounded-full"
          style={{ ...comic, background: "#ffe36e", color: "#1a1a1a", border: "2px solid #1a1a1a", boxShadow: "3px 3px 0 #1a1a1a", fontSize: `max(15px, ${u(1.9)})`, padding: `${u(0.1)} ${u(1.1)}` }}
          data-testid="memory-moves"
        >
          Moves {moves}
        </div>
        <div className="rounded-full font-bold" style={{ background: RED, color: CREAM, fontSize: `max(11px, ${u(1.2)})`, padding: `${u(0.2)} ${u(1)}` }}>
          {matched.length}/{pairs} pairs
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
            const isMatched = matched.includes(c.key);
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
                    : isMatched && lastMatch === c.key
                      ? { scale: [1, 1.15, 1], rotate: 0, x: 0 }
                      : { scale: 1, rotate: 0, x: 0 }
                }
                transition={{ delay: moves === 0 && !isMatched ? i * 0.03 : 0, duration: 0.35 }}
                whileTap={!faceUp ? { scale: 0.93 } : undefined}
                onPointerDown={() => flip(c)}
                data-testid="card"
                data-key={c.key}
                data-up={faceUp ? "1" : "0"}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{ transformStyle: "preserve-3d" }}
                  animate={{ rotateY: faceUp ? 180 : 0 }}
                  transition={{ duration: 0.35 }}
                >
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

      <AnimatePresence>
        {done && (
          <motion.div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: "rgba(255,250,240,0.5)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Sparkles />
            <motion.div
              initial={{ scale: 0.3, rotate: -12 }}
              animate={{ scale: 1, rotate: -3 }}
              transition={{ type: "spring", stiffness: 480, damping: 12 }}
              className="rounded-[20px] text-center"
              style={{ ...script, background: RED, color: CREAM, border: `3px solid ${GOLD}`, fontSize: `max(26px, ${u(4)})`, padding: `${u(1)} ${u(3)}`, boxShadow: "0 8px 20px rgba(60,8,10,0.4)" }}
            >
              All pairs in {moves} moves!
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
