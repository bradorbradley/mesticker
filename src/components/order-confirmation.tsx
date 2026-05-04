"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PartyPopper, Package, Sparkles, Share2, Copy, Check } from "lucide-react";
import { hapticSuccess } from "@/lib/haptics";

interface OrderConfirmationProps {
  imageUrl: string;
  quantity: number;
  onNewSticker: () => void;
}

export default function OrderConfirmation({
  imageUrl,
  quantity,
  onNewSticker,
}: OrderConfirmationProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    hapticSuccess();
  }, []);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}?ref=${Date.now().toString(36).slice(-6)}`
      : "https://mesticker.fun";

  const shareText =
    "I just made a custom sticker of myself at mesticker.fun — order yours and the first sheet is on me 🎨";

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Make your own MeSticker",
          text: shareText,
          url: shareUrl,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 py-6">
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
        <p className="text-muted-foreground mt-2 text-sm">
          Your stickers are being printed. Tracking email lands when they ship.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full glass-strong rounded-2xl p-5 shadow-card flex items-center gap-4"
      >
        <div className="w-20 h-20 rounded-xl overflow-hidden shadow-soft flex-shrink-0 sticker-sheen bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Your sticker"
            className="w-full h-full object-contain"
          />
        </div>
        <div>
          <p className="font-bold flex items-center gap-2">
            <Package size={16} className="text-primary" />
            {quantity} kiss-cut sheet{quantity > 1 ? "s" : ""}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Ships free in the US in 3–5 days.
          </p>
        </div>
      </motion.div>

      {/* SHARE / REFER — every shipped order is a marketing impression */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="w-full rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 flex flex-col gap-3"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Share + earn a free sheet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When a friend orders through your link, you both get $5 off your next order.
            </p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleShare}
          className="w-full py-2.5 rounded-xl font-semibold text-sm btn-gradient shadow-glow flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <Check size={14} /> Link copied!
            </>
          ) : (
            <>
              <Share2 size={14} /> Share your sticker
            </>
          )}
        </motion.button>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        whileTap={{ scale: 0.95 }}
        onClick={onNewSticker}
        className="w-full glass-strong border border-border py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
      >
        <Sparkles size={16} className="text-primary" />
        Make another sticker
      </motion.button>
    </div>
  );
}
