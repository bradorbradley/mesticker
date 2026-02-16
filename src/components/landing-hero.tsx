"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { hapticMedium } from "@/lib/haptics";

interface LandingHeroProps {
  onStart: () => void;
}

/** Stacked sticker showcase — the hero visual */
const heroStickers = [
  { src: "/presets/simpsons.jpg", rotate: -8, x: -54, y: 12, z: 1, label: "Simpsons" },
  { src: "/presets/spongebob.webp", rotate: 7, x: 54, y: 8, z: 2, label: "SpongeBob" },
  { src: "/presets/3d-animated.jpg", rotate: -1, x: 0, y: -8, z: 3, label: "Pixar" },
];

const styleExamples = [
  { src: "/presets/3d-animated.jpg", label: "Pixar" },
  { src: "/presets/simpsons.jpg", label: "Simpsons" },
  { src: "/presets/spongebob.webp", label: "SpongeBob" },
  { src: "/presets/rick-morty.webp", label: "Rick & Morty" },
  { src: "/presets/chibi.jpg", label: "Chibi" },
  { src: "/presets/family-guy.webp", label: "Family Guy" },
];

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
          <span className="gradient-text">Your face,</span>
          <br />
          <span className="gradient-text">as a sticker.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-3 text-center text-base text-muted-foreground leading-relaxed"
        >
          Snap a selfie. Pick a cartoon style.
          <br />
          Get <span className="font-bold text-foreground">real stickers</span> shipped to you.
        </motion.p>

        {/* Stacked sticker showcase */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 120 }}
          className="relative mt-8 mb-2"
          style={{ width: 260, height: 200 }}
        >
          {heroStickers.map((sticker, i) => (
            <motion.div
              key={sticker.label}
              className="absolute left-1/2 top-1/2 w-[140px] h-[140px]"
              initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: sticker.rotate }}
              transition={{
                duration: 0.5,
                delay: 0.3 + i * 0.12,
                type: "spring",
                stiffness: 150,
              }}
              style={{
                marginLeft: -70 + sticker.x,
                marginTop: -70 + sticker.y,
                zIndex: sticker.z,
              }}
            >
              <div className="w-full h-full rounded-2xl overflow-hidden shadow-card border-[3px] border-white relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sticker.src}
                  alt={`${sticker.label} sticker example`}
                  className="w-full h-full object-cover"
                />
                <div className="sticker-sheen absolute inset-0 pointer-events-none opacity-30" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55, type: "spring", stiffness: 200 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            hapticMedium();
            onStart();
          }}
          className="mt-4 btn-gradient px-12 py-4 rounded-2xl text-lg font-bold shadow-glow flex items-center gap-2"
        >
          Make yours
          <ArrowRight size={20} />
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="mt-2.5 text-xs text-muted-foreground"
        >
          Free to try &middot; no sign-up
        </motion.p>
      </div>

      {/* Style examples — the variety sell */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="px-5 pb-5"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center mb-3">
          6 styles to choose from
        </p>
        <div className="grid grid-cols-6 gap-2">
          {styleExamples.map((ex) => (
            <div key={ex.label} className="text-center">
              <div className="aspect-square rounded-xl overflow-hidden shadow-soft border-2 border-white/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ex.src}
                  alt={`${ex.label} style`}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-[9px] font-bold text-muted-foreground mt-1 truncate">
                {ex.label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* How it works — single line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
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
