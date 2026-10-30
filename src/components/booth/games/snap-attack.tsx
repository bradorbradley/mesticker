"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/booth-sounds";
import { cn } from "@/lib/utils";
import { u } from "../units";

/**
 * Snap Attack — Snap pops up in the photo frames; tap him to take his picture.
 * Gold Snap is worth 3. It speeds up as you score.
 */

type Pop = { id: number; hole: number; gold: boolean; until: number };
type Hit = { id: number; hole: number; text: string };

const HOLES = 6;
const TINTS = ["#ffe4ef", "#e6f9ff", "#fff3d1", "#efe9ff", "#dcfce7", "#ffe9d6"];

export default function SnapAttack() {
  const [pops, setPops] = useState<Pop[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [flashHole, setFlashHole] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const nextId = useRef(1);
  const scoreRef = useRef(0);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("mesticker-attack-best")) || 0);
    } catch {}
  }, []);

  // Spawner: faster and busier as the score climbs.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const spawn = () => {
      if (!alive) return;
      const s = scoreRef.current;
      const stay = Math.max(620, 1250 - s * 22);
      const now = Date.now();
      setPops((cur) => {
        const live = cur.filter((p) => p.until > now);
        if (live.length >= (s > 15 ? 2 : 1)) return live;
        const free = Array.from({ length: HOLES }, (_, i) => i).filter((i) => !live.some((p) => p.hole === i));
        const hole = free[Math.floor(Math.random() * free.length)];
        return [...live, { id: nextId.current++, hole, gold: Math.random() < 0.12, until: now + stay }];
      });
      timer = setTimeout(spawn, Math.max(380, 800 - s * 14) + Math.random() * 300);
    };
    timer = setTimeout(spawn, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // Expire pops that weren't tapped (breaks the combo).
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setPops((cur) => {
        const expired = cur.some((p) => p.until <= now);
        if (expired) setCombo(0);
        return expired ? cur.filter((p) => p.until > now) : cur;
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  const tap = useCallback(
    (hole: number) => {
      sounds.unlock();
      const pop = pops.find((p) => p.hole === hole && p.until > Date.now());
      if (!pop) {
        setShake(hole);
        setCombo(0);
        setTimeout(() => setShake(null), 300);
        return;
      }
      sounds.shutter();
      setPops((cur) => cur.filter((p) => p.id !== pop.id));
      setFlashHole(hole);
      setTimeout(() => setFlashHole(null), 250);
      const nextCombo = combo + 1;
      const pts = (pop.gold ? 3 : 1) + (nextCombo >= 5 ? 1 : 0);
      setCombo(nextCombo);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setBest((b) => {
        const nb = Math.max(b, scoreRef.current);
        try {
          localStorage.setItem("mesticker-attack-best", String(nb));
        } catch {}
        return nb;
      });
      const text = pop.gold ? `✨ GOLD +${pts}` : nextCombo >= 5 ? `🔥 x${nextCombo} +${pts}` : `📸 +${pts}`;
      const hit = { id: nextId.current++, hole, text };
      setHits((h) => [...h, hit]);
      setTimeout(() => setHits((h) => h.filter((x) => x.id !== hit.id)), 900);
    },
    [pops, combo]
  );

  return (
    <div className="flex h-full w-full flex-col" style={{ padding: u(2), gap: u(1.4) }}>
      <div className="flex shrink-0 flex-wrap items-center justify-between" style={{ gap: u(0.8) }}>
        <div className="t-h3">Tap Snap to take his picture! 📸</div>
        <div className="flex" style={{ gap: u(1) }}>
          {combo >= 3 && (
            <motion.span key={combo} className="chip whitespace-nowrap bg-[var(--orange)] text-white" initial={{ scale: 1.4 }} animate={{ scale: 1 }}>
              🔥 x{combo}
            </motion.span>
          )}
          <span className="chip whitespace-nowrap bg-[var(--purple)] text-white">Score {score}</span>
          <span className="chip whitespace-nowrap bg-white text-[var(--ink)]">Best {best}</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 landscape:grid-cols-3 landscape:grid-rows-2 short:!grid-cols-6 short:!grid-rows-1 portrait:grid-cols-2 portrait:grid-rows-3" style={{ gap: u(1.4) }}>
        {Array.from({ length: HOLES }, (_, hole) => {
          const pop = pops.find((p) => p.hole === hole);
          return (
            <motion.button
              key={hole}
              className="card relative min-h-0 overflow-hidden"
              style={{ background: TINTS[hole], borderRadius: u(2) }}
              animate={shake === hole ? { x: [0, -8, 8, -5, 0] } : { x: 0 }}
              transition={{ duration: 0.3 }}
              onPointerDown={() => tap(hole)}
            >
              {/* frame corners */}
              <span className="pointer-events-none absolute inset-[8%] rounded-[12px] border-[3px] border-dashed border-white/80" />
              <AnimatePresence>
                {pop && (
                  <motion.div
                    key={pop.id}
                    className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
                    style={{ height: "92%" }}
                    initial={{ y: "100%" }}
                    animate={{ y: "8%" }}
                    exit={{ y: "100%", transition: { duration: 0.18 } }}
                    transition={{ type: "spring", stiffness: 520, damping: 22 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/booth/mascot.webp"
                      alt=""
                      draggable={false}
                      className={cn("h-full object-contain", pop.gold && "[filter:sepia(1)_saturate(4)_hue-rotate(-12deg)_brightness(1.15)_drop-shadow(0_0_12px_#feca57)]")}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {flashHole === hole && (
                  <motion.div className="pointer-events-none absolute inset-0 bg-white" initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
                )}
              </AnimatePresence>
              <AnimatePresence>
                {hits
                  .filter((h) => h.hole === hole)
                  .map((h) => (
                    <motion.div
                      key={h.id}
                      className="t-h3 pointer-events-none absolute inset-x-0 top-[30%] text-center text-[var(--purple)]"
                      style={{ textShadow: "0 0 6px #fff, 0 0 12px #fff" }}
                      initial={{ y: 0, opacity: 1, scale: 0.6 }}
                      animate={{ y: -40, opacity: 0, scale: 1.3 }}
                      transition={{ duration: 0.85, ease: "easeOut" }}
                    >
                      {h.text}
                    </motion.div>
                  ))}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
