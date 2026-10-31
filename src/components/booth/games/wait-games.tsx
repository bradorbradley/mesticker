"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { sounds } from "@/lib/booth-sounds";
import SnapRig from "../snap-rig";
import { u } from "../units";
import TicTacToe from "./tic-tac-toe";
import SnapToss from "./snap-toss";
import SnapAttack from "./snap-attack";

/** The mini-games guests play while their sticker is being made. */
export const WAIT_GAMES = [
  { id: "ttt", label: "⭕ Tic-Tac-Toe", short: "⭕ XO", Comp: TicTacToe },
  { id: "toss", label: "🎯 Snap Toss", short: "🎯 Toss", Comp: SnapToss },
  { id: "attack", label: "📸 Snap Attack", short: "📸 Snap", Comp: SnapAttack },
] as const;

export type WaitGameId = (typeof WAIT_GAMES)[number]["id"];

/**
 * "It's ready!" takeover: covers whatever game is running, Snap cheers, a
 * 3-second ring counts down, then `onGo` (straight to the sticker). Tap to skip.
 */
export function ReadyTakeover({ onGo }: { onGo: () => void }) {
  const [count, setCount] = useState(3);
  useEffect(() => {
    sounds.success();
  }, []);
  useEffect(() => {
    if (count <= 0) {
      onGo();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count, onGo]);

  return (
    <motion.button
      className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(245,241,255,0.9)] backdrop-blur-sm landscape:flex-row portrait:flex-col"
      style={{ gap: u(3) }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onGo}
    >
      <SnapRig expression="happy" mood="excited" cheerKey={1} className="h-[42vh] short:h-[50vh] portrait:h-[30vh]" />
      <div className="flex flex-col items-center text-center" style={{ gap: u(1.5) }}>
        <motion.h2 className="t-hero" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
          It&apos;s <span className="pop">ready!</span>
        </motion.h2>
        <div className="relative flex items-center justify-center" style={{ width: u(9), height: u(9) }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <defs>
              <linearGradient id="ready-ring">
                <stop offset="0" stopColor="#7c5cfc" />
                <stop offset="1" stopColor="#ff6b9d" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="44" stroke="#e4dcff" strokeWidth="9" fill="none" />
            <motion.circle
              cx="50"
              cy="50"
              r="44"
              stroke="url(#ready-ring)"
              strokeWidth="9"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 1 }}
              animate={{ pathLength: 0 }}
              transition={{ duration: 3, ease: "linear" }}
            />
          </svg>
          <span className="font-fun font-bold" style={{ fontSize: u(4) }}>
            {Math.max(count, 1)}
          </span>
        </div>
        <span className="t-body">Taking you to your sticker…</span>
      </div>
    </motion.button>
  );
}
