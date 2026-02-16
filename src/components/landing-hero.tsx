"use client";

import { motion } from "framer-motion";
import { Camera, Sparkles, Package, ArrowRight, ChevronRight } from "lucide-react";
import { hapticMedium } from "@/lib/haptics";

interface LandingHeroProps {
  onStart: () => void;
}

const exampleStickers = [
  { src: "/presets/3d-animated.jpg", label: "Pixar" },
  { src: "/presets/simpsons.jpg", label: "Simpsons" },
  { src: "/presets/spongebob.webp", label: "SpongeBob" },
  { src: "/presets/rick-morty.webp", label: "Rick & Morty" },
  { src: "/presets/chibi.jpg", label: "Chibi" },
  { src: "/presets/family-guy.webp", label: "Family Guy" },
];

const steps = [
  {
    icon: Camera,
    title: "Snap a selfie",
    desc: "Take a photo or upload one",
    color: "from-primary to-primary-light",
  },
  {
    icon: Sparkles,
    title: "Pick a style",
    desc: "Pixar, SpongeBob & more",
    color: "from-accent-pink to-accent-orange",
  },
  {
    icon: Package,
    title: "Get stickers",
    desc: "Shipped to your door",
    color: "from-accent-cyan to-primary",
  },
];

export default function LandingHero({ onStart }: LandingHeroProps) {
  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      {/* Hero — title + sequence + CTA */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-14 pb-6">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-4xl font-bold tracking-tight text-center leading-tight"
        >
          <span className="gradient-text">Your face,</span>
          <br />
          <span className="gradient-text">as a sticker.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-2 text-center text-base text-muted-foreground max-w-[260px] leading-relaxed"
        >
          AI turns your selfie into a cartoon.
          <br />
          We print &amp; ship real stickers.
        </motion.p>

        {/* 3-step visual sequence: Selfie → AI Art → Sticker */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-8 flex items-center justify-center gap-2"
        >
          {/* Step 1: Selfie placeholder */}
          <div className="text-center">
            <div className="w-[88px] h-[88px] rounded-2xl bg-gradient-to-br from-[#f0e4d4] via-[#e8d5c0] to-[#d4bfa8] flex flex-col items-center justify-center shadow-soft border-2 border-white/60">
              <Camera size={24} className="text-[#8b7355]/60" />
              <span className="text-[9px] font-bold text-[#8b7355]/50 mt-1">Your selfie</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1.5">Photo</p>
          </div>

          <ChevronRight size={18} className="text-muted-foreground/40 flex-shrink-0 mt-[-16px]" />

          {/* Step 2: AI cartoon */}
          <div className="text-center">
            <div className="w-[88px] h-[88px] rounded-2xl overflow-hidden shadow-card border-2 border-white/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/presets/3d-animated.jpg"
                alt="AI cartoon result"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1.5">AI Cartoon</p>
          </div>

          <ChevronRight size={18} className="text-muted-foreground/40 flex-shrink-0 mt-[-16px]" />

          {/* Step 3: Die-cut sticker */}
          <div className="text-center">
            <div className="w-[88px] h-[88px] rounded-2xl overflow-hidden shadow-glow border-2 border-primary/20 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/presets/3d-animated.jpg"
                alt="Die-cut sticker"
                className="w-full h-full object-cover"
              />
              {/* Die-cut sticker border effect */}
              <div className="absolute inset-0 rounded-2xl ring-2 ring-white/50 ring-inset" />
              <div className="sticker-sheen absolute inset-0 pointer-events-none opacity-40" />
            </div>
            <p className="text-[10px] font-bold gradient-text mt-1.5">Sticker!</p>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.45, type: "spring", stiffness: 200 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            hapticMedium();
            onStart();
          }}
          className="mt-8 btn-gradient px-10 py-4 rounded-2xl text-lg font-bold shadow-glow flex items-center gap-2"
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
          3 free creations &middot; no sign-up
        </motion.p>
      </div>

      {/* Style examples */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.5 }}
        className="px-5 pb-6"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center mb-3">
          Choose your style
        </p>
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {exampleStickers.map((ex) => (
            <div key={ex.label} className="flex-shrink-0 w-[72px]">
              <div className="w-[72px] h-[72px] rounded-xl overflow-hidden shadow-card border-2 border-white/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ex.src}
                  alt={`${ex.label} style`}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-[10px] font-bold text-center mt-1 text-muted-foreground">
                {ex.label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="px-5 pb-10"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center mb-3">
          How it works
        </p>
        <div className="flex gap-2">
          {steps.map((step) => (
            <div
              key={step.title}
              className="flex-1 glass-strong rounded-2xl p-3 shadow-soft text-center"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto shadow-md`}
              >
                <step.icon size={18} className="text-white" />
              </div>
              <p className="font-display font-bold text-xs mt-2">{step.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
