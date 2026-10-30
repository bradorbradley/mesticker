"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/booth-sounds";
import { cn } from "@/lib/utils";
import { u } from "../units";
import TicTacToe from "./tic-tac-toe";
import SnapToss from "./snap-toss";
import SnapAttack from "./snap-attack";

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
                <button className="btn btn-main" onClick={() => setStarted(Date.now())}>
                  See it →
                </button>
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
          <motion.div key={game} className="absolute inset-0" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Game />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
