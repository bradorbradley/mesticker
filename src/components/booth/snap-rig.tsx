"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MascotMood } from "./mascot";

/**
 * Snap, rigged. The photo of the plush is the body; his eyes and mouth are
 * redrawn on top in SVG so he can blink, look around and pull faces.
 *
 * Coordinates are in the cutout's pixel space (571×900), measured from the
 * image: eyes at (261,265) and (410,263), mouth at (336,298).
 */

export type Expression = "smile" | "grin" | "happy" | "surprised" | "sad" | "thinking";

const EYES = [
  { x: 261.4, y: 264.9, fur: "#d9bd9f" },
  { x: 410.2, y: 262.9, fur: "#f3d8bf" },
];
const MOUTH = { x: 336.4, y: 297.9, fur: "#e6d2b6" };
const INK = "#171523";

const loop = { repeat: Infinity, ease: "easeInOut" as const };
// Body motion, pivoting at the feet so hops squash and stretch like a cartoon.
const BODY: Record<MascotMood | "cheer", { animate: Record<string, number[] | number>; transition: Record<string, unknown> }> = {
  idle: { animate: { y: [0, -8, 0], scaleY: [1, 1.015, 1], scaleX: [1, 0.99, 1], rotate: 0 }, transition: { duration: 2.8, ...loop } },
  excited: {
    animate: { y: [0, 0, -34, 0, 0], scaleY: [1, 0.86, 1.08, 0.9, 1], scaleX: [1, 1.1, 0.95, 1.06, 1], rotate: [0, 0, -4, 3, 0] },
    transition: { duration: 0.8, repeat: Infinity, repeatDelay: 0.25, times: [0, 0.18, 0.5, 0.82, 1] },
  },
  cheer: {
    animate: { y: [0, 0, -46, 0, 0], scaleY: [1, 0.82, 1.1, 0.88, 1], scaleX: [1, 1.12, 0.94, 1.08, 1], rotate: [0, 0, 360, 360, 360] },
    transition: { duration: 1.1, times: [0, 0.15, 0.55, 0.85, 1] },
  },
  working: { animate: { rotate: [-3, 3, -3], y: 0, scaleY: 1, scaleX: 1 }, transition: { duration: 1.1, ...loop } },
  thinking: { animate: { rotate: [0, -6, -6, 0], y: [0, -3, -3, 0], scaleY: 1, scaleX: 1 }, transition: { duration: 1.8, ...loop } },
  sad: { animate: { rotate: -7, y: 10, scaleY: 0.93, scaleX: 1.04 }, transition: { type: "spring", stiffness: 140, damping: 9 } },
};

function useBlink() {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        setClosed(true);
        setTimeout(() => setClosed(false), 130);
        // occasional double blink
        if (Math.random() < 0.25) setTimeout(() => (setClosed(true), setTimeout(() => setClosed(false), 110)), 300);
        schedule();
      }, 2200 + Math.random() * 2800);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);
  return closed;
}

function Eye({ x, y, expression, look, blink }: { x: number; y: number; expression: Expression; look: { x: number; y: number }; blink: boolean }) {
  if (expression === "happy") {
    // closed, smiling ^ eyes
    return <path d={`M${x - 14} ${y + 5} Q${x} ${y - 14} ${x + 14} ${y + 5}`} stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />;
  }
  const big = expression === "surprised" ? 1.2 : 1;
  const lid = expression === "sad" ? 0.8 : 1;
  const lx = look.x * 6;
  const ly = look.y * 5 + (expression === "thinking" ? -5 : 0);
  return (
    <motion.g
      animate={{ x: lx, y: ly, scaleY: blink ? 0.08 : lid * big, scaleX: big }}
      transition={{ type: "spring", stiffness: 500, damping: 30, scaleY: { duration: blink ? 0.06 : 0.12 } }}
      style={{ transformOrigin: `${x}px ${y}px`, transformBox: "view-box" }}
    >
      <ellipse cx={x} cy={y} rx="14" ry="16" fill={INK} />
      <circle cx={x - 5} cy={y - 6} r="4.6" fill="#fff" opacity="0.92" />
      <circle cx={x + 5} cy={y + 6} r="1.8" fill="#fff" opacity="0.5" />
    </motion.g>
  );
}

function Mouth({ expression }: { expression: Expression }) {
  const { x, y } = MOUTH;
  switch (expression) {
    case "grin":
    case "happy":
      return (
        <g>
          <path d={`M${x - 22} ${y - 5} Q${x} ${y + 26} ${x + 22} ${y - 5} Z`} fill="#3b1a22" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx={x + 2} cy={y + 9} rx="9" ry="5" fill="#ff7aa2" />
        </g>
      );
    case "surprised":
      return <ellipse cx={x} cy={y + 4} rx="9" ry="11" fill="#3b1a22" stroke={INK} strokeWidth="3" />;
    case "sad":
      return <path d={`M${x - 16} ${y + 7} Q${x} ${y - 7} ${x + 16} ${y + 7}`} stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />;
    case "thinking":
      return <path d={`M${x - 10} ${y + 2} Q${x + 2} ${y - 1} ${x + 12} ${y + 3}`} stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />;
    default:
      return null; // the photo's own smile
  }
}

export default function SnapRig({
  className,
  style,
  mood = "idle",
  expression = "smile",
  look = { x: 0, y: 0 },
  cheerKey,
}: {
  className?: string;
  style?: React.CSSProperties;
  mood?: MascotMood;
  expression?: Expression;
  /** where he's looking, -1..1 on each axis */
  look?: { x: number; y: number };
  /** change this to make him do a backflip cheer */
  cheerKey?: number;
}) {
  const blink = useBlink();
  const [cheering, setCheering] = useState(false);
  useEffect(() => {
    if (cheerKey === undefined || cheerKey === 0) return;
    setCheering(true);
    const t = setTimeout(() => setCheering(false), 1100);
    return () => clearTimeout(t);
  }, [cheerKey]);
  const body = BODY[cheering ? "cheer" : mood];
  const replaceMouth = expression !== "smile";

  return (
    <motion.div
      className={cn("relative aspect-[571/900] select-none", className)}
      style={{ transformOrigin: "50% 100%", ...style }}
      animate={body.animate}
      transition={body.transition}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/booth/mascot.webp" alt="Snap" draggable={false} className="h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(91,63,214,0.25)]" />
      <svg viewBox="0 0 571 900" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <filter id="fur-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>
        {/* paint over the photo's eyes (and mouth) so the drawn ones can move */}
        {EYES.map((e) => (
          <ellipse key={e.x} cx={e.x} cy={e.y} rx="21" ry="23" fill={e.fur} filter="url(#fur-soft)" />
        ))}
        {replaceMouth && <ellipse cx={MOUTH.x} cy={MOUTH.y} rx="31" ry="13" fill={MOUTH.fur} filter="url(#fur-soft)" />}
        {/* sad brows */}
        <AnimatePresence>
          {expression === "sad" && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <path d={`M${EYES[0].x - 16} ${EYES[0].y - 26} L${EYES[0].x + 12} ${EYES[0].y - 34}`} stroke={INK} strokeWidth="5" strokeLinecap="round" />
              <path d={`M${EYES[1].x - 12} ${EYES[1].y - 34} L${EYES[1].x + 16} ${EYES[1].y - 26}`} stroke={INK} strokeWidth="5" strokeLinecap="round" />
            </motion.g>
          )}
        </AnimatePresence>
        {EYES.map((e) => (
          <Eye key={e.x} x={e.x} y={e.y} expression={expression} look={look} blink={blink} />
        ))}
        <Mouth expression={expression} />
      </svg>
    </motion.div>
  );
}
