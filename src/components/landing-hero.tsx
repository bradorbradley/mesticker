"use client";

import { motion } from "framer-motion";
import { Camera, Sparkles, Package, ArrowRight } from "lucide-react";
import { hapticMedium } from "@/lib/haptics";
import HeroDemoSlider from "@/components/hero-demo-slider";

interface LandingHeroProps {
  onStart: () => void;
}

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

const exampleStickers = [
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
      {/* Top section — title + demo, vertically centered */}
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

        {/* Auto-playing hero demo */}
        <div className="mt-6 w-full max-w-[300px]">
          <HeroDemoSlider />
        </div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.5, type: "spring", stiffness: 200 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            hapticMedium();
            onStart();
          }}
          className="mt-6 btn-gradient px-10 py-4 rounded-2xl text-lg font-bold shadow-glow flex items-center gap-2"
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
          3 free creations &middot; no sign-up
        </motion.p>
      </div>

      {/* Style examples — horizontal scroll */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
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

      {/* How it works — compact 3-column */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.4 }}
        className="px-5 pb-10"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center mb-3">
          How it works
        </p>
        <div className="flex gap-2">
          {steps.map((step, i) => (
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
              {i < steps.length - 1 && (
                <div className="hidden" />
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
