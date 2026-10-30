"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import SnapRig, { type Expression } from "./snap-rig";

export type MascotMood = "idle" | "excited" | "working" | "thinking" | "sad";

const FACE: Record<MascotMood, Expression> = {
  idle: "smile",
  excited: "happy",
  working: "thinking",
  thinking: "thinking",
  sad: "sad",
};

/**
 * "Snap", the booth's press-photographer mascot: the rigged character
 * (blinks, looks around, pulls faces) plus his camera flash.
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
  return (
    <div className={cn("relative aspect-[571/900] select-none", className)} style={style}>
      <SnapRig className="h-full w-full" mood={mood} expression={flash ? "surprised" : FACE[mood]} />
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
    </div>
  );
}
