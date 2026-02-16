"use client";

import { motion } from "framer-motion";
import { Camera, Sparkles, Package, ChevronDown } from "lucide-react";
import { hapticMedium } from "@/lib/haptics";
import ImageRevealSlider from "@/components/image-reveal";

interface LandingHeroProps {
  onStart: () => void;
}

const floatingStickers = [
  { emoji: "🎨", x: "8%", y: "18%", delay: 0, size: "text-4xl", rotate: -12 },
  { emoji: "⭐", x: "82%", y: "12%", delay: 0.5, size: "text-3xl", rotate: 15 },
  { emoji: "🖼️", x: "88%", y: "55%", delay: 1.2, size: "text-3xl", rotate: -8 },
  { emoji: "✨", x: "5%", y: "60%", delay: 0.8, size: "text-2xl", rotate: 20 },
  { emoji: "🎭", x: "75%", y: "82%", delay: 1.5, size: "text-3xl", rotate: -15 },
  { emoji: "🌟", x: "15%", y: "85%", delay: 0.3, size: "text-2xl", rotate: 10 },
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

const exampleStickers = [
  { src: "/presets/3d-animated.jpg", label: "Pixar" },
  { src: "/presets/simpsons.jpg", label: "Simpsons" },
  { src: "/presets/spongebob.webp", label: "SpongeBob" },
  { src: "/presets/rick-morty.webp", label: "Rick & Morty" },
  { src: "/presets/chibi.jpg", label: "Chibi" },
  { src: "/presets/family-guy.webp", label: "Family Guy" },
];

// Simple SVG placeholder for the "before" side of the demo slider
const DEMO_BEFORE_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#e8ddd0"/>
      <stop offset="100%" stop-color="#c9b99a"/>
    </linearGradient>
    <radialGradient id="face" cx="0.5" cy="0.4" r="0.5">
      <stop offset="0%" stop-color="#d4b896"/>
      <stop offset="100%" stop-color="#c4a882"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <circle cx="200" cy="155" r="65" fill="url(#face)"/>
  <ellipse cx="200" cy="340" rx="90" ry="75" fill="url(#face)"/>
  <ellipse cx="200" cy="155" r="70" ry="45" cy="110" fill="#8b7355" opacity="0.7"/>
  <text x="200" y="390" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#8b7355" opacity="0.6">Your photo</text>
</svg>`)}`;

export default function LandingHero({ onStart }: LandingHeroProps) {
  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
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

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-4 text-center text-lg text-muted-foreground max-w-xs leading-relaxed"
        >
          Turn your face into a cartoon sticker.
          <br />
          <span className="font-semibold text-foreground">For real.</span> We ship it to you.
        </motion.p>

        {/* Interactive demo slider */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-8 w-full max-w-xs"
        >
          <ImageRevealSlider
            beforeSrc={DEMO_BEFORE_SVG}
            afterSrc="/presets/3d-animated.jpg"
            altBefore="Your photo"
            altAfter="Sticker"
            height={260}
            initial={30}
            showGlow
          />
          <p className="text-center text-xs text-muted-foreground mt-2">
            Slide to see the magic
          </p>
        </motion.div>

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
          className="mt-6 btn-gradient px-10 py-4 rounded-2xl text-lg font-bold shadow-glow"
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

      {/* Example stickers gallery */}
      <div className="px-6 pb-8">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75 }}
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center mb-4"
        >
          Pick from popular styles
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2"
        >
          {exampleStickers.map((ex) => (
            <div
              key={ex.label}
              className="flex-shrink-0 w-28 group"
            >
              <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-card border-2 border-white/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ex.src}
                  alt={`${ex.label} style example`}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-semibold text-center mt-1.5 text-muted-foreground">
                {ex.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

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
