"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  mood?: "idle" | "excited" | "working";
  flash?: boolean;
}) {
  const motionProps =
    mood === "excited"
      ? { animate: { y: [0, -28, 0], rotate: [0, -4, 4, 0] }, transition: { duration: 0.7, repeat: Infinity, repeatDelay: 0.5 } }
      : mood === "working"
        ? { animate: { rotate: [-2, 2, -2] }, transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const } }
        : { animate: { y: [0, -10, 0] }, transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const } };

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
