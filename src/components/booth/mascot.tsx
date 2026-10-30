"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export type MascotMood = "idle" | "excited" | "working" | "thinking" | "sad";

const loop = { repeat: Infinity, ease: "easeInOut" as const };
const MOODS: Record<MascotMood, { animate: Record<string, number[] | number>; transition: Record<string, unknown> }> = {
  idle: { animate: { y: [0, -10, 0], rotate: 0, scale: 1 }, transition: { duration: 3.2, ...loop } },
  excited: { animate: { y: [0, -28, 0], rotate: [0, -4, 4, 0], scale: 1 }, transition: { duration: 0.7, repeat: Infinity, repeatDelay: 0.5 } },
  working: { animate: { rotate: [-2, 2, -2], y: 0, scale: 1 }, transition: { duration: 1.2, ...loop } },
  thinking: { animate: { rotate: [0, -7, -7, 0], y: [0, -4, -4, 0], scale: 1 }, transition: { duration: 1.6, ...loop } },
  sad: { animate: { rotate: -9, y: 12, scale: 0.94 }, transition: { type: "spring", stiffness: 120, damping: 10 } },
};

/**
 * "Snap", the booth's press-photographer mascot.
 * `flash` fires the camera's flash bulb; `mood` picks the idle motion.
 */
export default function Mascot({
  className,
  mood = "idle",
  flash = false,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
  mood?: MascotMood;
  flash?: boolean;
}) {
  const motionProps = MOODS[mood];

  return (
    <motion.div className={cn("relative aspect-[571/900] select-none", className)} style={style} {...motionProps}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/booth/mascot.webp"
        alt="Snap, the MeSticker mascot"
        draggable={false}
        className="h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(91,63,214,0.25)]"
      />
      {/* Flash bulb sits at ~13% x / 29% y of the cutout */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            className="pointer-events-none absolute rounded-full"
            style={{
              left: "13%",
              top: "29%",
              width: "10%",
              aspectRatio: "1",
              translate: "-50% -50%",
              background: "radial-gradient(circle, #fff 0%, rgba(255,250,220,0.9) 30%, rgba(255,240,180,0) 70%)",
            }}
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 9, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
