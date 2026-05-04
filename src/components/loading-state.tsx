"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const messages = [
  "Analyzing your photo...",
  "Teaching AI to draw you...",
  "Adding cartoon energy...",
  "Perfecting the details...",
  "Removing the background...",
  "Making you sticker-ready...",
  "Almost there...",
];

interface LoadingStateProps {
  photo?: string | null;
  className?: string;
}

export default function LoadingState({ photo, className }: LoadingStateProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [countdown, setCountdown] = useState(30);

  // Countdown timer — ticks every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Rotate messages every 4300ms (~7 messages across 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 4300);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center gap-6 py-8 ${className || ""}`}>
      {/* Central animation area */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* Spinning ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, #7C5CFC, #FF6B9D, #FF9F43, #7C5CFC)",
            padding: 3,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-full h-full rounded-full bg-background" />
        </motion.div>

        {/* Photo preview or placeholder */}
        {photo ? (
          <motion.div
            className="relative w-40 h-40 rounded-full overflow-hidden"
            animate={{
              filter: [
                "saturate(1) blur(0px)",
                "saturate(1.5) blur(1px)",
                "saturate(0.5) hue-rotate(30deg) blur(0px)",
                "saturate(1.2) hue-rotate(-20deg) blur(1px)",
                "saturate(1) blur(0px)",
              ],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt="Your photo"
              className="w-full h-full object-cover"
            />
          </motion.div>
        ) : (
          <motion.div
            className="w-40 h-40 rounded-full gradient-primary opacity-20"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Sparkle particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: ["#7C5CFC", "#FF6B9D", "#FF9F43", "#45E3FF", "#FECA57", "#2ED573"][i],
            }}
            animate={{
              x: [0, Math.cos((i * 60 * Math.PI) / 180) * 80],
              y: [0, Math.sin((i * 60 * Math.PI) / 180) * 80],
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.35,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      {/* Countdown number */}
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="wait">
          {countdown > 0 ? (
            <motion.div
              key={countdown}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 0.3 }}
              className="text-4xl font-display font-bold gradient-text tabular-nums"
            >
              {countdown}
            </motion.div>
          ) : (
            <motion.p
              key="finishing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-lg font-display font-bold text-primary"
            >
              Finishing up...
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Animated message */}
      <div className="h-6 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-semibold text-muted-foreground text-center"
          >
            {messages[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
