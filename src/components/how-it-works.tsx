"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface HowItWorksProps {
  photoSrc: string;
  cartoonSrc: string;
  sheetSrc: string;
  label1?: string;
  label2?: string;
  label3?: string;
}

/**
 * 3-step "this is how it works" sequence with arrows.
 *   1. Original photo
 *   2. AI cartoon sticker
 *   3. Sticker sheet preview
 *
 * Visual at-a-glance for niche landing pages.
 */
export default function HowItWorks({
  photoSrc,
  cartoonSrc,
  sheetSrc,
  label1 = "Upload photo",
  label2 = "Get your cartoon",
  label3 = "Order the sheet",
}: HowItWorksProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold text-center">
        How it works
      </h2>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5">
        {/* Step 1 — photo */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-1.5"
        >
          <div className="aspect-square w-full rounded-2xl overflow-hidden shadow-card border-2 border-white bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc}
              alt="Step 1 — your photo"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-[10px] font-bold text-center leading-tight">
            <span className="text-primary">1.</span> {label1}
          </p>
        </motion.div>

        <ArrowRight size={18} className="text-primary flex-shrink-0" />

        {/* Step 2 — cartoon */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center gap-1.5"
        >
          <div className="aspect-square w-full rounded-2xl overflow-hidden shadow-card border-2 border-white bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cartoonSrc}
              alt="Step 2 — your cartoon"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-[10px] font-bold text-center leading-tight">
            <span className="text-primary">2.</span> {label2}
          </p>
        </motion.div>

        <ArrowRight size={18} className="text-primary flex-shrink-0" />

        {/* Step 3 — sheet */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center gap-1.5"
        >
          <div className="aspect-[7/10] w-full rounded-2xl overflow-hidden shadow-card border-2 border-white bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sheetSrc}
              alt="Step 3 — your sticker sheet"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-[10px] font-bold text-center leading-tight">
            <span className="text-primary">3.</span> {label3}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
