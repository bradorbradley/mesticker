"use client";

import { motion } from "framer-motion";
import { hapticSuccess } from "@/lib/haptics";
import { useEffect } from "react";

interface StickerRevealProps {
  imageUrl: string;
  className?: string;
}

export default function StickerReveal({ imageUrl, className }: StickerRevealProps) {
  useEffect(() => {
    hapticSuccess();
  }, []);

  return (
    <div className={`relative flex items-center justify-center py-4 ${className || ""}`}>
      {/* Burst particles behind the sticker */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 rounded-full"
          style={{
            background: [
              "#7C5CFC", "#FF6B9D", "#FF9F43", "#45E3FF",
              "#FECA57", "#2ED573", "#A78BFA", "#5B9FFF",
            ][i],
          }}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0, 1.5, 0],
            x: Math.cos((i * 45 * Math.PI) / 180) * 120,
            y: Math.sin((i * 45 * Math.PI) / 180) * 120,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 0.8,
            delay: 0.2 + i * 0.05,
            ease: "easeOut",
          }}
        />
      ))}

      {/* The sticker itself */}
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 12,
          delay: 0.1,
        }}
        className="relative"
      >
        <div className="relative w-72 h-72 sticker-sheen rounded-3xl overflow-hidden shadow-glow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Your sticker"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Subtle floating animation after reveal */}
        <motion.div
          className="absolute inset-0"
          animate={{ y: [0, -4, 0], rotate: [0, 1, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </motion.div>
    </div>
  );
}
