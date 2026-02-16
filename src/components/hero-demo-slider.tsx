"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Camera } from "lucide-react";

const DEMO_AFTER = "/presets/3d-animated.jpg";

/** Timing for the auto-play loop (ms) */
const PAUSE_BEFORE = 1200; // pause showing the "photo" side
const REVEAL_DURATION = 1400; // slide to reveal sticker
const PAUSE_AFTER = 2200; // pause showing the sticker
const RESET_DURATION = 1000; // slide back to photo

const START_POS = 12; // mostly photo visible
const END_POS = 92; // mostly sticker visible

export default function HeroDemoSlider() {
  const position = useMotionValue(START_POS);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);

  // Derived values
  const clipRight = useTransform(position, (v) => `${100 - v}%`);
  const handleLeft = useTransform(position, (v) => `${v}%`);
  const glowIntensity = useTransform(position, [50, 100], [0, 1]);
  const glowShadow = useTransform(
    glowIntensity,
    (g) =>
      g > 0
        ? `0 0 ${30 * g}px ${10 * g}px rgba(124, 92, 252, ${0.3 * g}), 0 0 ${60 * g}px ${20 * g}px rgba(255, 107, 157, ${0.15 * g})`
        : "0 8px 30px rgba(124, 92, 252, 0.12)"
  );

  const sleep = useCallback(
    (ms: number) => new Promise((r) => setTimeout(r, ms)),
    []
  );

  useEffect(() => {
    if (!imageLoaded) return;

    let cancelled = false;

    const loop = async () => {
      // Small initial delay
      await sleep(600);

      while (!cancelled) {
        // Pause on "photo" side
        await sleep(PAUSE_BEFORE);
        if (cancelled) break;

        // Reveal sticker
        animRef.current = animate(position, END_POS, {
          duration: REVEAL_DURATION / 1000,
          ease: [0.25, 0.1, 0.25, 1], // smooth ease-out
        });
        await animRef.current;
        if (cancelled) break;

        // Pause on sticker
        await sleep(PAUSE_AFTER);
        if (cancelled) break;

        // Slide back
        animRef.current = animate(position, START_POS, {
          duration: RESET_DURATION / 1000,
          ease: [0.25, 0.1, 0.25, 1],
        });
        await animRef.current;
        if (cancelled) break;
      }
    };

    loop();

    return () => {
      cancelled = true;
      animRef.current?.stop();
    };
  }, [imageLoaded, position, sleep]);

  return (
    <motion.div
      ref={containerRef}
      className="relative overflow-hidden rounded-3xl select-none"
      style={{
        height: 320,
        boxShadow: glowShadow,
      }}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
    >
      {/* "Before" side — CSS-only, no image to load */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#f0e4d4] via-[#e8d5c0] to-[#d4bfa8]">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
            <Camera size={28} className="text-[#8b7355]/70" />
          </div>
          <span className="text-sm font-semibold text-[#8b7355]/60 tracking-wide">
            Your selfie
          </span>
        </div>
      </div>

      {/* "After" side — real preset image */}
      <motion.div
        className="absolute inset-0"
        style={{
          clipPath: useTransform(clipRight, (r) => `inset(0 ${r} 0 0)`),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={DEMO_AFTER}
          alt="Pixar style sticker"
          className="w-full h-full object-cover"
          draggable={false}
          onLoad={() => setImageLoaded(true)}
        />
        {/* Sticker sheen overlay */}
        <motion.div
          className="sticker-sheen absolute inset-0 pointer-events-none"
          style={{ opacity: useTransform(glowIntensity, (g) => g * 0.5) }}
        />
      </motion.div>

      {/* Divider line */}
      <motion.div
        className="absolute top-0 bottom-0 w-0.5 bg-white/80"
        style={{
          left: handleLeft,
          x: "-50%",
          filter: "drop-shadow(0 0 4px rgba(0,0,0,0.2))",
        }}
      />

      {/* Handle */}
      <motion.div
        className="absolute w-10 h-10 rounded-full bg-white border-2 border-primary shadow-lg flex items-center justify-center"
        style={{
          left: handleLeft,
          top: "50%",
          x: "-50%",
          y: "-50%",
        }}
      >
        <div className="flex gap-0.5">
          <div className="w-0.5 h-4 bg-primary/50 rounded-full" />
          <div className="w-0.5 h-4 bg-primary/50 rounded-full" />
        </div>
      </motion.div>

      {/* Labels */}
      <motion.div
        className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-xs font-bold"
        style={{ opacity: useTransform(position, [10, 30], [1, 0]) }}
      >
        Photo
      </motion.div>
      <motion.div
        className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-xs font-bold"
        style={{ opacity: useTransform(position, [70, 90], [0, 1]) }}
      >
        Sticker
      </motion.div>
    </motion.div>
  );
}
