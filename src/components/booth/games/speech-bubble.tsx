"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/** Snap's comic speech bubble. Changing `text` pops a new bubble in. */
export default function SpeechBubble({ text, className, tail = "bottom" }: { text: string; className?: string; tail?: "bottom" | "left" }) {
  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div
          key={text}
          className={cn("card t-h3 relative w-fit max-w-[16em] text-center", className)}
          style={{ padding: "0.5em 0.9em" }}
          initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: -2 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 20 }}
        >
          {text}
          <span
            className={cn(
              "absolute h-[0.9em] w-[0.9em] rotate-45 bg-white",
              tail === "bottom" ? "-bottom-[0.4em] left-1/2 -translate-x-1/2" : "-left-[0.4em] top-1/2 -translate-y-1/2"
            )}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
