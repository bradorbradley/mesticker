"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/booth-sounds";
import { cn } from "@/lib/utils";
import { u } from "../units";
import TicTacToe from "./tic-tac-toe";
import SnapToss from "./snap-toss";
import SnapAttack from "./snap-attack";
import SnapRig from "../snap-rig";

/**
 * Game Lab — the loading-screen mini-games in isolation, with a fake
 * "your sticker is cooking" bar so you can feel the real wait.
 */

const GAMES = [
  { id: "ttt", label: "⭕ Tic-Tac-Toe", Comp: TicTacToe },
  { id: "toss", label: "🎯 Snap Toss", Comp: SnapToss },
  { id: "attack", label: "📸 Snap Attack", Comp: SnapAttack },
] as const;

const WAIT_MS = 25000;

export default function GameLab() {
  const [game, setGame] = useState<(typeof GAMES)[number]["id"]>("ttt");
  const [started, setStarted] = useState(() => Date.now());
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setProgress(Math.min(1, (Date.now() - started) / WAIT_MS)), 150);
    return () => clearInterval(id);
  }, [started]);

  const ready = progress >= 1;
  const Game = GAMES.find((g) => g.id === game)!.Comp;

  // When the sticker is ready the game steps aside on its own:
  // a 3-second "it's ready!" moment, then straight to the reveal.
  const [phase, setPhase] = useState<"playing" | "ready" | "reveal">("playing");
  const [count, setCount] = useState(3);
  useEffect(() => {
    if (ready && phase === "playing") {
      setPhase("ready");
      setCount(3);
      sounds.success();
    }
  }, [ready, phase]);
  useEffect(() => {
    if (phase !== "ready") return;
    if (count <= 0) {
      setPhase("reveal");
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, count]);
  const restart = () => {
    setPhase("playing");
    setStarted(Date.now());
    setProgress(0);
  };

  return (
    <div className="booth fixed inset-0 z-40 flex flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between" style={{ minHeight: `max(56px, ${u(6.5)})`, padding: `${u(0.6)} ${u(3)}`, gap: u(1) }}>
        <div className="font-fun font-bold" style={{ fontSize: `max(17px, ${u(2.6)})` }}>
          Me<span className="pop">Sticker</span> <span className="text-[var(--ink-2)]">Game Lab</span>
        </div>
        <nav className="flex flex-wrap" style={{ gap: u(0.6) }}>
          {GAMES.map((g) => (
            <button
              key={g.id}
              className={cn("chip min-h-[36px]", g.id === game ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--ink)]")}
              onClick={() => {
                sounds.tap();
                setGame(g.id);
              }}
            >
              {g.label}
            </button>
          ))}
        </nav>
      </header>

      {/* fake sticker-generation progress */}
      <div className="shrink-0" style={{ padding: `0 ${u(3)}` }}>
        <div className="card relative flex items-center overflow-hidden" style={{ gap: u(1.2), padding: `${u(0.5)} ${u(1.2)}`, minHeight: 44 }}>
          <AnimatePresence mode="wait">
            {ready ? (
              <motion.div key="ready" className="flex w-full items-center justify-between" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ gap: u(1) }}>
                <span className="t-h3">🎉 Your sticker is ready!</span>
              </motion.div>
            ) : (
              <motion.div key="wait" className="flex w-full items-center" style={{ gap: u(1.2) }} exit={{ opacity: 0 }}>
                <span className="t-body shrink-0 font-bold text-[var(--ink)]">✨ Making your sticker</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--lav)]">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--pink)]" animate={{ width: `${progress * 100}%` }} />
                </div>
                <span className="t-body shrink-0">{Math.ceil(((1 - progress) * WAIT_MS) / 1000)}s</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <main className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {phase === "reveal" ? (
            <motion.div key="reveal" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <MockReveal onAgain={restart} />
            </motion.div>
          ) : (
            <motion.div key={game} className="absolute inset-0" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <Game />
            </motion.div>
          )}
        </AnimatePresence>

        {/* "It's ready!" takeover */}
        <AnimatePresence>
          {phase === "ready" && (
            <motion.button
              key="ready"
              className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(245,241,255,0.88)] backdrop-blur-sm landscape:flex-row portrait:flex-col"
              style={{ gap: u(3) }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPhase("reveal")}
            >
              <SnapRig expression="happy" mood="excited" cheerKey={1} className="h-[42vh] short:h-[50vh] portrait:h-[30vh]" />
              <div className="flex flex-col items-center text-center" style={{ gap: u(1.5) }}>
                <motion.h2 className="t-hero" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
                  It&apos;s <span className="pop">ready!</span>
                </motion.h2>
                <div className="relative flex items-center justify-center" style={{ width: u(9), height: u(9) }}>
                  <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                    <circle cx="50" cy="50" r="44" stroke="#e4dcff" strokeWidth="9" fill="none" />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="44"
                      stroke="url(#ring)"
                      strokeWidth="9"
                      fill="none"
                      strokeLinecap="round"
                      initial={{ pathLength: 1 }}
                      animate={{ pathLength: 0 }}
                      transition={{ duration: 3, ease: "linear" }}
                    />
                    <defs>
                      <linearGradient id="ring">
                        <stop offset="0" stopColor="#7c5cfc" />
                        <stop offset="1" stopColor="#ff6b9d" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="font-fun font-bold" style={{ fontSize: u(4) }}>
                    {Math.max(count, 1)}
                  </span>
                </div>
                <span className="t-body">Taking you to your sticker…</span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/** Stand-in for the booth's reveal screen. */
function MockReveal({ onAgain }: { onAgain: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center landscape:flex-row portrait:flex-col" style={{ gap: u(4), padding: u(2) }}>
      <motion.div
        className="card overflow-hidden"
        style={{ width: "min(40vh, 70vw)", padding: u(0.6), rotate: -4 }}
        initial={{ scale: 0.3, rotate: -20 }}
        animate={{ scale: 1, rotate: -4 }}
        transition={{ type: "spring", stiffness: 160, damping: 12 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/presets/chibi.jpg" alt="Sample sticker" className="aspect-square w-full object-cover" style={{ borderRadius: u(1.4) }} />
      </motion.div>
      <div className="flex flex-col portrait:items-center portrait:text-center" style={{ gap: u(1.6) }}>
        <h2 className="t-h2">
          Ta-da! <span className="pop">Love it?</span>
        </h2>
        <p className="t-lead">In the booth this is the real reveal + pay screen.</p>
        <button className="btn btn-main w-fit" onClick={onAgain}>
          ↺ Try the wait again
        </button>
      </div>
    </div>
  );
}
