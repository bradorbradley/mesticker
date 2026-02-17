"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { hapticMedium } from "@/lib/haptics";

interface LandingHeroProps {
  onStart: () => void;
}

// Hero images — selfie and the resulting die-cut sticker
const HERO_SELFIE = "/presets/renaissance.jpg";
const HERO_STICKER =
  "https://0iztdnrnvx25ufoo.public.blob.vercel-storage.com/sticker-1771283199268.png";

const styleExamples = [
  { src: "/presets/3d-animated.jpg", label: "Pixar" },
  { src: "/presets/simpsons.jpg", label: "Simpsons" },
  { src: "/presets/spongebob.webp", label: "SpongeBob" },
  { src: "/presets/rick-morty.webp", label: "Rick & Morty" },
  { src: "/presets/chibi.jpg", label: "Chibi" },
  { src: "/presets/family-guy.webp", label: "Family Guy" },
];

// Double the array for seamless looping
const carouselItems = [...styleExamples, ...styleExamples];

function StyleCarouselStrip() {
  const controls = useAnimationControls();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Each card is 80px wide + 12px gap = 92px, 6 cards = one set width
    const setWidth = styleExamples.length * 92;

    controls.set({ x: 0 });
    controls.start({
      x: -setWidth,
      transition: {
        duration: 20,
        ease: "linear",
        repeat: Infinity,
        repeatType: "loop",
      },
    });
  }, [controls]);

  return (
    <div ref={containerRef} className="overflow-hidden w-full">
      <motion.div animate={controls} className="flex gap-3 w-max">
        {carouselItems.map((ex, i) => (
          <div key={`${ex.label}-${i}`} className="text-center flex-shrink-0 w-20">
            <div className="aspect-square rounded-xl overflow-hidden shadow-soft border-2 border-white/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ex.src}
                alt={`${ex.label} style`}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1 truncate">
              {ex.label}
            </p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function LandingHero({ onStart }: LandingHeroProps) {
  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-12 pb-4">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-5xl font-bold tracking-tight text-center leading-[1.1]"
        >
          <span className="gradient-text">MeSticker</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-3 text-center text-lg text-foreground font-medium leading-relaxed"
        >
          Turn any selfie into a <span className="gradient-text font-bold">custom cartoon sticker</span>
          <br />
          <span className="text-base text-muted-foreground">and we&apos;ll ship it to your door</span>
        </motion.p>

        {/* Selfie → Sticker visual */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 flex items-center gap-4"
        >
          {/* Before: selfie */}
          <div className="relative">
            <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-soft border-2 border-white/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HERO_SELFIE}
                alt="Original selfie"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider bg-white/90 text-muted-foreground px-2 py-0.5 rounded-full shadow-sm">
              Photo
            </span>
          </div>

          {/* Arrow */}
          <ChevronRight className="text-muted-foreground/40 flex-shrink-0" size={28} />

          {/* After: die-cut sticker */}
          <div className="relative">
            <div className="w-36 h-36 flex items-center justify-center drop-shadow-[0_4px_12px_rgba(168,85,247,0.35)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HERO_STICKER}
                alt="AI-generated sticker"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider bg-white/90 text-muted-foreground px-2 py-0.5 rounded-full shadow-sm">
              Sticker
            </span>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5, type: "spring", stiffness: 200 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            hapticMedium();
            onStart();
          }}
          className="mt-8 btn-gradient px-12 py-4 rounded-2xl text-lg font-bold shadow-glow flex items-center gap-2"
        >
          Make yours
          <ArrowRight size={20} />
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-2.5 text-xs text-muted-foreground"
        >
          Free to try &middot; no sign-up
        </motion.p>
      </div>

      {/* Style carousel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.5 }}
        className="pb-5"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center mb-3">
          6 styles to choose from
        </p>
        <StyleCarouselStrip />
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="px-5 pb-10"
      >
        <div className="glass-strong rounded-2xl p-4 shadow-soft">
          <div className="flex items-center justify-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-[10px] font-bold">1</span>
              <span className="font-bold">Snap</span>
            </div>
            <span className="text-muted-foreground/30">&rarr;</span>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-accent-pink to-accent-orange flex items-center justify-center text-white text-[10px] font-bold">2</span>
              <span className="font-bold">Style</span>
            </div>
            <span className="text-muted-foreground/30">&rarr;</span>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-accent-cyan to-primary flex items-center justify-center text-white text-[10px] font-bold">3</span>
              <span className="font-bold">Ship</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
