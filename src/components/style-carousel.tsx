"use client";

import { useState, useCallback, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { StylePreset } from "@/types";
import { stylePresets } from "@/lib/presets";
import { hapticLight } from "@/lib/haptics";
import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react";

interface StyleCarouselProps {
  onActiveChange: (preset: StylePreset) => void;
  className?: string;
}

/** Colors mapped to each style for the card accent */
const styleColors: Record<string, string> = {
  pixar: "from-blue-400 to-cyan-300",
  spongebob: "from-yellow-300 to-amber-400",
  simpsons: "from-yellow-400 to-yellow-500",
  "rick-and-morty": "from-green-400 to-emerald-500",
  "family-guy": "from-sky-400 to-blue-500",
  chibi: "from-pink-300 to-rose-400",
  random: "from-primary to-accent-pink",
};

export default function StyleCarousel({
  onActiveChange,
  className,
}: StyleCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 0.8, 1, 0.8, 0.5]);

  // Auto-select whichever card is currently visible — no tap required
  useEffect(() => {
    onActiveChange(stylePresets[currentIndex]);
  }, [currentIndex, onActiveChange]);

  const goTo = useCallback(
    (newIndex: number) => {
      const wrapped =
        ((newIndex % stylePresets.length) + stylePresets.length) %
        stylePresets.length;
      setCurrentIndex(wrapped);
      hapticLight();
    },
    []
  );

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 50;
      if (info.offset.x < -threshold) {
        goTo(currentIndex + 1);
      } else if (info.offset.x > threshold) {
        goTo(currentIndex - 1);
      }
    },
    [currentIndex, goTo]
  );

  const preset = stylePresets[currentIndex];
  const gradientClass = styleColors[preset.id] || "from-primary to-accent-pink";
  const isRandom = preset.id === "random";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Card stack area */}
      <div className="relative w-full h-[320px] flex items-center justify-center">
        {/* Background cards (peeking behind) */}
        {[-1, 1].map((offset) => {
          const idx =
            ((currentIndex + offset) % stylePresets.length +
              stylePresets.length) %
            stylePresets.length;
          const bgPreset = stylePresets[idx];
          return (
            <div
              key={`bg-${offset}`}
              className="absolute w-[260px] h-[300px] rounded-3xl overflow-hidden shadow-soft"
              style={{
                transform: `translateX(${offset * 20}px) scale(0.9) rotate(${offset * 3}deg)`,
                zIndex: 0,
                opacity: 0.4,
              }}
            >
              <div
                className={`w-full h-full bg-gradient-to-br ${styleColors[bgPreset.id] || "from-gray-200 to-gray-300"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bgPreset.previewImage}
                  alt=""
                  className="w-full h-full object-cover opacity-60"
                />
              </div>
            </div>
          );
        })}

        {/* Active card — draggable */}
        <motion.div
          key={currentIndex}
          className="absolute w-[280px] h-[320px] rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing z-10 ring-4 ring-primary shadow-glow"
          style={{ x, rotate, opacity }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={handleDragEnd}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          whileTap={{ scale: 0.97 }}
        >
          {/* Card background gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-90`} />

          {/* Preview image */}
          {!isRandom ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preset.previewImage}
              alt={preset.name}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Shuffle size={80} className="text-white/40" />
            </div>
          )}

          {/* Bottom info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
            <h3 className="font-display text-2xl font-bold text-white drop-shadow-md">
              {preset.name}
            </h3>
            <p className="text-white/80 text-sm mt-0.5">{preset.description}</p>
          </div>

          {/* Glossy sheen */}
          <div className="sticker-sheen absolute inset-0 pointer-events-none" />
        </motion.div>
      </div>

      {/* Navigation dots + arrows */}
      <div className="flex items-center gap-4 mt-4">
        <button
          onClick={() => goTo(currentIndex - 1)}
          className="w-9 h-9 rounded-full glass-strong flex items-center justify-center shadow-soft active:scale-90 transition-transform"
          aria-label="Previous style"
        >
          <ChevronLeft size={18} className="text-muted-foreground" />
        </button>

        <div className="flex gap-1.5">
          {stylePresets.map((p, i) => (
            <button
              key={p.id}
              onClick={() => goTo(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === currentIndex
                  ? "w-6 gradient-primary"
                  : "w-2 bg-border hover:bg-primary/30"
              )}
              aria-label={`Go to ${p.name}`}
            />
          ))}
        </div>

        <button
          onClick={() => goTo(currentIndex + 1)}
          className="w-9 h-9 rounded-full glass-strong flex items-center justify-center shadow-soft active:scale-90 transition-transform"
          aria-label="Next style"
        >
          <ChevronRight size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Swipe hint */}
      <p className="text-xs text-muted-foreground mt-3">
        Swipe to browse styles
      </p>
    </div>
  );
}
