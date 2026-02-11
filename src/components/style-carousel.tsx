"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { StylePreset } from "@/types";
import { stylePresets } from "@/lib/presets";
import { Check } from "lucide-react";

interface StyleCarouselProps {
  selected: string | null;
  onSelect: (preset: StylePreset) => void;
  className?: string;
}

// Emoji fallbacks for style previews (since we don't have actual preview images)
const styleEmojis: Record<string, string> = {
  "cartoon-pop": "🎨",
  anime: "✨",
  "pixel-art": "👾",
  watercolor: "🖌️",
  chibi: "🧸",
  "comic-book": "💥",
};

export default function StyleCarousel({
  selected,
  onSelect,
  className,
}: StyleCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1 snap-x snap-mandatory"
      >
        {stylePresets.map((preset) => {
          const isSelected = selected === preset.id;
          return (
            <motion.button
              key={preset.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(preset)}
              className={cn(
                "flex-shrink-0 w-[140px] snap-center rounded-xl border-2 p-3 transition-all text-left",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-surface hover:border-primary/40"
              )}
            >
              <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center text-3xl mb-2">
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                )}
                {styleEmojis[preset.id] || "🎨"}
              </div>
              <p className="font-semibold text-sm truncate">{preset.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {preset.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
