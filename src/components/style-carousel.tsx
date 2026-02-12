"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { StylePreset } from "@/types";
import { stylePresets } from "@/lib/presets";
import { Check, Shuffle } from "lucide-react";

interface StyleCarouselProps {
  selected: string | null;
  onSelect: (preset: StylePreset) => void;
  className?: string;
}

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
          const hasPreview = !!preset.previewImage;
          return (
            <motion.button
              key={preset.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(preset)}
              className={cn(
                "flex-shrink-0 w-[130px] snap-center rounded-xl border-2 p-3 transition-all text-left relative overflow-hidden",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-surface hover:border-primary/40"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10">
                  <Check size={12} className="text-white" />
                </div>
              )}
              <div className="w-full aspect-square rounded-lg overflow-hidden mb-2 bg-muted flex items-center justify-center">
                {hasPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preset.previewImage}
                    alt={preset.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                    <Shuffle size={32} className="text-white drop-shadow-md" />
                  </div>
                )}
              </div>
              <p className="font-semibold text-sm truncate">{preset.name}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-tight">
                {preset.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
