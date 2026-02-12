"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const messages = [
  "Removing background...",
  "Applying style magic...",
  "Generating your sticker...",
  "Almost there...",
];

interface LoadingStateProps {
  className?: string;
}

export default function LoadingState({ className }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-6 py-12 ${className || ""}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
      >
        <Sparkles size={32} className="text-primary" />
      </motion.div>
      <div className="flex flex-col items-center gap-2">
        {messages.map((msg, i) => (
          <motion.p
            key={msg}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 3, duration: 0.5 }}
            className="text-sm text-muted-foreground text-center"
          >
            {msg}
          </motion.p>
        ))}
      </div>
      <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 12, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}
