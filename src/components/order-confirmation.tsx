"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { PartyPopper, Package, Sparkles } from "lucide-react";
import { hapticSuccess } from "@/lib/haptics";
import { STICKERS_PER_SHEET } from "@/lib/stripe";

interface OrderConfirmationProps {
  imageUrl: string;
  totalSheets: number;
  onNewSticker: () => void;
}

export default function OrderConfirmation({
  imageUrl,
  totalSheets,
  onNewSticker,
}: OrderConfirmationProps) {
  useEffect(() => {
    hapticSuccess();
  }, []);

  const totalStickers = totalSheets * STICKERS_PER_SHEET;

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {/* Celebration burst */}
      <div className="relative">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: ["#7C5CFC", "#FF6B9D", "#FF9F43", "#FECA57", "#2ED573", "#45E3FF"][i],
              left: "50%",
              top: "50%",
            }}
            initial={{ scale: 0 }}
            animate={{
              scale: [0, 1.5, 0],
              x: Math.cos((i * 60 * Math.PI) / 180) * 60 - 4,
              y: Math.sin((i * 60 * Math.PI) / 180) * 60 - 4,
            }}
            transition={{ duration: 0.8, delay: 0.2 + i * 0.08, ease: "easeOut" }}
          />
        ))}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <PartyPopper size={56} className="text-accent-orange" />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center"
      >
        <h2 className="font-display text-3xl font-bold gradient-text">
          Order Confirmed!
        </h2>
        <p className="text-muted-foreground mt-2">
          Your stickers are being printed
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full glass-strong rounded-2xl p-5 shadow-card flex items-center gap-4"
      >
        <div className="w-20 h-20 rounded-xl overflow-hidden shadow-soft flex-shrink-0 sticker-sheen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Your sticker"
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <p className="font-bold flex items-center gap-2">
            <Package size={16} className="text-primary" />
            {totalSheets} {totalSheets === 1 ? "sheet" : "sheets"} ({totalStickers} stickers)
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            You&apos;ll get a tracking email when they ship.
          </p>
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        whileTap={{ scale: 0.95 }}
        onClick={onNewSticker}
        className="w-full btn-gradient py-4 rounded-2xl text-base font-bold shadow-glow flex items-center justify-center gap-2"
      >
        <Sparkles size={18} />
        Create Another Sticker
      </motion.button>
    </div>
  );
}
