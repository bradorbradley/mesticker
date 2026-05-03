"use client";

import { motion } from "framer-motion";
import { Camera, Sparkles, Package, ChevronDown } from "lucide-react";
import { hapticMedium } from "@/lib/haptics";
import { stylePresets } from "@/lib/presets";

interface LandingHeroProps {
  onStart: () => void;
}

// Floating decorations kept minimal — hero image does the talking
const floatingStickers = [
  { emoji: "✨", x: "5%", y: "25%", delay: 0, size: "text-2xl", rotate: -12 },
  { emoji: "✨", x: "88%", y: "30%", delay: 0.5, size: "text-2xl", rotate: 15 },
];

const steps = [
  {
    icon: Camera,
    title: "Snap a selfie",
    desc: "Take a photo or upload from your gallery",
    color: "from-primary to-primary-light",
  },
  {
    icon: Sparkles,
    title: "Pick a style",
    desc: "Pixar, SpongeBob, Simpsons, and more",
    color: "from-accent-pink to-accent-orange",
  },
  {
    icon: Package,
    title: "Get stickers",
    desc: "Real kiss-cut stickers shipped to your door",
    color: "from-accent-cyan to-primary",
  },
];

export default function LandingHero({ onStart }: LandingHeroProps) {
  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden max-w-lg mx-auto">
      {/* Floating decorative elements */}
      {floatingStickers.map((s, i) => (
        <motion.div
          key={i}
          className={`absolute ${s.size} pointer-events-none select-none`}
          style={{ left: s.x, top: s.y }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: 0.6,
            scale: 1,
            y: [0, -12, 0],
            rotate: [s.rotate, s.rotate + 5, s.rotate],
          }}
          transition={{
            opacity: { delay: s.delay, duration: 0.5 },
            scale: { delay: s.delay, duration: 0.5, type: "spring" },
            y: { delay: s.delay + 0.5, duration: 4, repeat: Infinity, ease: "easeInOut" },
            rotate: { delay: s.delay + 0.5, duration: 5, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          {s.emoji}
        </motion.div>
      ))}

      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        {/* Logo / brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-2"
        >
          <span className="text-sm font-semibold tracking-widest uppercase text-primary/60">
            Introducing
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display text-5xl font-bold tracking-tight text-center leading-tight"
        >
          <span className="gradient-text">MeSticker</span>
        </motion.h1>

        {/* Before → After hero visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-5 flex items-center justify-center gap-4"
        >
          <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-card border-2 border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/presets/hero-before.jpg"
              alt="Your selfie"
              className="w-full h-full object-cover"
            />
          </div>
          <motion.div
            animate={{ x: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-3xl text-primary font-bold"
          >
            →
          </motion.div>
          <motion.div
            className="w-28 h-28 rounded-2xl overflow-hidden shadow-card border-2 border-primary/30"
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/presets/hero-after.jpg"
              alt="Cartoon sticker result"
              className="w-full h-full object-cover"
            />
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-4 text-center text-lg text-muted-foreground max-w-xs leading-relaxed"
        >
          Turn your selfie into a cartoon sticker.
          <br />
          <span className="font-semibold text-foreground">For real.</span> We print &amp; ship it to you.
        </motion.p>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.45, type: "spring", stiffness: 200 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            hapticMedium();
            onStart();
          }}
          className="mt-8 btn-gradient px-10 py-4 rounded-2xl text-lg font-bold shadow-glow"
        >
          Try it free
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-3 text-xs text-muted-foreground"
        >
          3 free creations, no sign-up needed
        </motion.p>
      </div>

      {/* Style preview marquee */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="overflow-hidden py-4"
      >
        <p className="text-xs text-center text-muted-foreground font-semibold uppercase tracking-wider mb-3">
          Styles you can try
        </p>
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10" />
          
          <motion.div
            className="flex gap-3 w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              x: {
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              },
            }}
          >
            {/* Double the items for seamless loop */}
            {[...stylePresets.filter(p => p.id !== "random"), ...stylePresets.filter(p => p.id !== "random")].map((preset, i) => (
              <div
                key={`${preset.id}-${i}`}
                className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden shadow-card border-2 border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preset.previewImage}
                  alt={preset.name}
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <p className="text-[10px] text-white font-semibold text-center">{preset.name}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* What you get — Product Showcase */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="px-6 py-6"
      >
        <p className="text-xs text-center text-muted-foreground font-semibold uppercase tracking-wider mb-4">
          What you get
        </p>
        <div className="grid grid-cols-2 gap-3">
          {/* Sticker Pack Card */}
          <div className="glass-strong rounded-2xl p-4 shadow-soft flex flex-col items-center text-center gap-2">
            <div className="relative w-full h-24 flex items-center justify-center">
              {/* Fan layout: 3 overlapping copies */}
              {[-12, 0, 12].map((rotate, i) => (
                <div
                  key={i}
                  className="absolute w-16 h-16 rounded-lg overflow-hidden shadow-card border border-border"
                  style={{
                    transform: `rotate(${rotate}deg)`,
                    zIndex: i,
                    left: `calc(50% - 32px + ${(i - 1) * 6}px)`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/presets/hero-after.jpg"
                    alt="Sticker"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <div>
              <p className="font-display font-bold text-sm">Sticker Pack</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                From $19.99 / 10+ identical stickers
              </p>
            </div>
          </div>

          {/* Variation Sheet Card */}
          <div className="glass-strong rounded-2xl p-4 shadow-soft flex flex-col items-center text-center gap-2">
            <div className="relative w-full h-24 flex items-center justify-center">
              {/* Mini 2x3 grid */}
              <div className="grid grid-cols-3 grid-rows-2 gap-1">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-md overflow-hidden border border-border bg-muted/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/presets/hero-after.jpg"
                      alt={`Variation ${i + 1}`}
                      className="w-full h-full object-cover"
                      style={{
                        filter: `hue-rotate(${i * 40}deg)`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-display font-bold text-sm">Variation Sheet</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                $14.99 / 6 unique poses
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* How it works */}
      <div className="px-6 pb-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex items-center justify-center gap-1 mb-6 text-muted-foreground"
        >
          <span className="text-xs font-semibold uppercase tracking-wider">How it works</span>
          <ChevronDown size={14} className="animate-bounce" />
        </motion.div>

        <div className="flex flex-col gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 + i * 0.15, duration: 0.4 }}
              className="flex items-center gap-4 glass-strong rounded-2xl p-4 shadow-soft"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0 shadow-md`}
              >
                <step.icon size={22} className="text-white" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
