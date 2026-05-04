"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { StylePreset } from "@/types";
import { getDisplayPresets } from "@/lib/presets";
import { hapticMedium } from "@/lib/haptics";
import { Shuffle, Pencil, X, Sparkles } from "lucide-react";
import {
  trackStyleGridViewed,
  trackCustomPromptOpened,
  trackCustomPromptSubmitted,
} from "@/lib/analytics";
import { useEffect } from "react";

interface StyleGridProps {
  onSelect: (preset: StylePreset, customPrompt?: string) => void;
  disabled?: boolean;
  className?: string;
}

const styleColors: Record<string, string> = {
  pixar: "from-blue-400 to-cyan-300",
  spongebob: "from-yellow-300 to-amber-400",
  simpsons: "from-yellow-400 to-yellow-500",
  "rick-and-morty": "from-green-400 to-emerald-500",
  "family-guy": "from-sky-400 to-blue-500",
  chibi: "from-pink-300 to-rose-400",
  anime: "from-purple-400 to-indigo-500",
  "comic-book": "from-red-400 to-orange-500",
  watercolor: "from-teal-300 to-cyan-400",
  random: "from-primary to-accent-pink",
  custom: "from-violet-400 to-fuchsia-500",
};

export default function StyleGrid({
  onSelect,
  disabled,
  className,
}: StyleGridProps) {
  const presets = getDisplayPresets();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [submittingCustom, setSubmittingCustom] = useState(false);

  useEffect(() => {
    trackStyleGridViewed();
  }, []);

  const handleTileClick = useCallback(
    (preset: StylePreset) => {
      if (disabled) return;

      if (preset.id === "custom") {
        setShowCustomInput(true);
        trackCustomPromptOpened();
        return;
      }

      hapticMedium();
      onSelect(preset);
    },
    [disabled, onSelect]
  );

  const handleCustomSubmit = useCallback(async () => {
    const trimmed = customPrompt.trim();
    if (!trimmed || trimmed.length < 5) {
      setCustomError("Describe the style you want (at least 5 characters)");
      return;
    }

    setSubmittingCustom(true);
    setCustomError(null);
    trackCustomPromptSubmitted(trimmed.length);

    // Client-side basic check, server does full moderation
    hapticMedium();
    const customPreset: StylePreset = {
      id: "custom",
      name: "Custom",
      description: trimmed,
      previewImage: "",
      prompt: "__CUSTOM__",
    };
    onSelect(customPreset, trimmed);
    setSubmittingCustom(false);
  }, [customPrompt, onSelect]);

  return (
    <div className={cn("w-full", className)}>
      {/* Custom prompt modal */}
      <AnimatePresence>
        {showCustomInput && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <Pencil size={14} />
                Describe your style
              </h3>
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomError(null);
                }}
                className="w-6 h-6 rounded-full bg-muted flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder='e.g. "Studio Ghibli watercolor style" or "90s retro pixel art"'
              className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background resize-none h-20"
              maxLength={200}
            />
            {customError && (
              <p className="text-xs text-red-500 mt-1">{customError}</p>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              disabled={submittingCustom || disabled}
              onClick={handleCustomSubmit}
              className="w-full mt-2 py-2.5 rounded-xl font-bold text-sm btn-gradient shadow-glow disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Sparkles size={14} />
              Generate in this style
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {presets.map((preset) => {
          const isRandom = preset.id === "random";
          const isCustom = preset.id === "custom";
          const gradient =
            styleColors[preset.id] || "from-gray-200 to-gray-300";

          return (
            <motion.button
              key={preset.id}
              whileTap={{ scale: 0.93 }}
              onClick={() => handleTileClick(preset)}
              disabled={disabled}
              className={cn(
                "relative aspect-square rounded-xl overflow-hidden shadow-soft",
                "border-2 border-transparent transition-all duration-200",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "active:ring-2 active:ring-primary"
              )}
            >
              {/* Background gradient */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`}
              />

              {/* Preview image */}
              {!isRandom && !isCustom && preset.previewImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preset.previewImage}
                  alt={preset.name}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  draggable={false}
                  loading="lazy"
                />
              )}

              {/* Random icon */}
              {isRandom && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shuffle size={28} className="text-white/60" />
                </div>
              )}

              {/* Custom icon */}
              {isCustom && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Pencil size={28} className="text-white/60" />
                </div>
              )}

              {/* Name overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-white text-[11px] font-bold leading-tight drop-shadow-sm truncate">
                  {preset.name}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
