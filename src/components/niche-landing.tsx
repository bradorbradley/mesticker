"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Star, Truck, Sparkles } from "lucide-react";

export interface NicheLandingProps {
  /** "Dog Stickers", "Stickers for Teachers", etc. */
  headline: string;
  /** Sub-line under headline */
  subhead: string;
  /** Niche-specific testimonial (real or sourced) */
  testimonial?: { quote: string; author: string };
  /** Sample sticker image src — uses /presets/* by default */
  sampleStickers?: string[];
  /** What the user "gets" — short bullets */
  bullets: string[];
  /** Primary CTA copy ("Make my dog's stickers" etc.) */
  ctaText: string;
}

const DEFAULT_SAMPLES = [
  "/presets/chibi.jpg",
  "/presets/3d-animated.jpg",
  "/presets/simpsons.jpg",
];

export default function NicheLanding({
  headline,
  subhead,
  testimonial,
  sampleStickers = DEFAULT_SAMPLES,
  bullets,
  ctaText,
}: NicheLandingProps) {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-background via-background to-primary/5">
      <div className="mx-auto max-w-md px-6 py-10 flex flex-col gap-8">
        {/* Brand wordmark */}
        <Link href="/" className="font-display text-2xl font-bold gradient-text text-center">
          MeSticker
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h1 className="font-display text-3xl font-bold leading-tight">
            {headline}
          </h1>
          <p className="text-base text-muted-foreground mt-3">{subhead}</p>
        </motion.div>

        {/* Sample stickers carousel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="flex gap-3 justify-center"
        >
          {sampleStickers.map((src, i) => (
            <motion.div
              key={i}
              initial={{ rotate: -8 + i * 6 }}
              animate={{ rotate: -8 + i * 6 }}
              whileHover={{ scale: 1.05, rotate: 0 }}
              className="w-24 h-24 rounded-2xl overflow-hidden shadow-card border-2 border-white"
              style={{ zIndex: i }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Sample sticker ${i + 1}`} className="w-full h-full object-cover" />
            </motion.div>
          ))}
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            href="/?source=niche"
            className="w-full py-4 rounded-2xl font-bold text-base btn-gradient shadow-glow flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            {ctaText}
            <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-center text-muted-foreground mt-2 flex items-center justify-center gap-3">
            <span className="flex items-center gap-1">
              <Truck size={12} /> Free US shipping
            </span>
            <span>·</span>
            <span>3–5 day delivery</span>
            <span>·</span>
            <span>$14.99/sheet</span>
          </p>
        </motion.div>

        {/* Bullets */}
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="rounded-2xl border border-border bg-card/50 p-5 flex flex-col gap-3"
        >
          {bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Star size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <span>{bullet}</span>
            </li>
          ))}
        </motion.ul>

        {/* Testimonial */}
        {testimonial && (
          <motion.blockquote
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="rounded-2xl border-l-4 border-primary bg-primary/5 p-5 italic text-sm"
          >
            <p>&ldquo;{testimonial.quote}&rdquo;</p>
            <p className="text-xs text-muted-foreground mt-2 not-italic font-semibold">
              — {testimonial.author}
            </p>
          </motion.blockquote>
        )}

        {/* Secondary CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75 }}
          className="text-center"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary font-bold text-sm hover:underline"
          >
            Start making yours now <ArrowRight size={14} />
          </Link>
          <p className="text-[11px] text-muted-foreground mt-1">
            Takes about 30 seconds. No sign-up.
          </p>
        </motion.div>
      </div>
    </main>
  );
}
