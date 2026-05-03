"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, RefreshCw, Loader2, ShoppingCart } from "lucide-react";
import { hapticLight, hapticMedium, hapticSuccess } from "@/lib/haptics";
import {
  trackVariationsStarted,
  trackVariationTileLoaded,
  trackVariationsComplete,
  trackVariationTileSelected,
  trackVariationTileRegenerated,
  trackVarietyPackBuilt,
  trackSheetComposed,
} from "@/lib/analytics";

interface Variation {
  index: number;
  image: string | null;
  latency: number;
  variation: string;
  error?: string;
}

interface VariationsGridProps {
  originalImage: string;
  stylePrompt: string;
  onOrderVarietyPack: (composedImage: string) => void;
  onTryAnotherStyle: () => void;
  className?: string;
}

export default function VariationsGrid({
  originalImage,
  stylePrompt,
  onOrderVarietyPack,
  onTryAnotherStyle,
  className,
}: VariationsGridProps) {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startTime = useRef(Date.now());
  const hasStarted = useRef(false);

  // Generate variations on mount
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const generate = async () => {
      setLoading(true);
      setError(null);
      startTime.current = Date.now();
      trackVariationsStarted();

      try {
        const res = await fetch("/api/variations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: originalImage,
            stylePrompt,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Variations failed");
        }

        const data = await res.json();
        setVariations(data.variations);

        // Track individual tile loads
        for (const v of data.variations) {
          if (v.image) {
            trackVariationTileLoaded(v.index, v.latency);
          }
        }

        // Auto-select all successful variations
        const successful = new Set<number>(
          data.variations
            .filter((v: Variation) => v.image)
            .map((v: Variation) => v.index)
        );
        setSelectedIndices(successful);

        trackVariationsComplete(Date.now() - startTime.current);
        hapticSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate variations");
      } finally {
        setLoading(false);
      }
    };

    generate();
  }, [originalImage, stylePrompt]);

  const toggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      trackVariationTileSelected(index);
      hapticLight();
      return next;
    });
  }, []);

  const handleRegenerate = useCallback(
    async (index: number) => {
      trackVariationTileRegenerated(index);

      // Mark this tile as loading
      setVariations((prev) =>
        prev.map((v) => (v.index === index ? { ...v, image: null, error: undefined } : v))
      );

      try {
        const res = await fetch("/api/variations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: originalImage,
            stylePrompt,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const newVariation = data.variations[index];
          if (newVariation?.image) {
            setVariations((prev) =>
              prev.map((v) => (v.index === index ? newVariation : v))
            );
            setSelectedIndices((prev) => new Set([...prev, index]));
          }
        }
      } catch {}
    },
    [originalImage, stylePrompt]
  );

  const [isComposing, setIsComposing] = useState(false);

  const handleOrderVarietyPack = useCallback(async () => {
    const selectedImages = variations
      .filter((v) => selectedIndices.has(v.index) && v.image)
      .map((v) => v.image!);

    if (selectedImages.length === 0) return;

    trackVarietyPackBuilt(selectedImages.length);
    hapticMedium();

    // Compose selected images into a single sheet
    setIsComposing(true);
    try {
      const res = await fetch("/api/compose-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: selectedImages }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sheet composition failed");
      }

      const data = await res.json();
      trackSheetComposed(selectedImages.length);
      onOrderVarietyPack(data.composedImage);
    } catch (err) {
      console.error("Compose error:", err);
      setIsComposing(false);
    }
  }, [variations, selectedIndices, onOrderVarietyPack]);

  const selectedCount = selectedIndices.size;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="text-center">
        <h2 className="font-display text-lg font-bold">Pick your favorites</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {selectedCount} selected — tap to toggle
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      {/* 2×3 Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {(loading ? Array.from({ length: 6 }, (_, i) => i) : variations).map(
          (item, i) => {
            const v = typeof item === "number" ? null : item;
            const index = v?.index ?? i;
            const isSelected = selectedIndices.has(index);
            const isLoaded = v?.image;
            const hasError = v?.error;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className={cn(
                  "relative aspect-square rounded-xl overflow-hidden border-2 transition-all",
                  isSelected
                    ? "border-primary shadow-glow"
                    : "border-border shadow-soft",
                  isLoaded && "cursor-pointer"
                )}
                onClick={() => isLoaded && toggleSelect(index)}
              >
                {isLoaded ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v!.image!}
                      alt={`Variation ${index + 1}`}
                      className="w-full h-full object-contain bg-muted/30"
                    />
                    {/* Selection checkmark */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md"
                      >
                        <Check size={14} className="text-white" />
                      </motion.div>
                    )}
                    {/* Regenerate button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerate(index);
                      }}
                      className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </>
                ) : hasError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 text-muted-foreground">
                    <p className="text-xs mb-1">Failed</p>
                    <button
                      onClick={() => handleRegenerate(index)}
                      className="text-xs text-primary font-semibold"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/20">
                    <Loader2 size={20} className="animate-spin text-primary/40" />
                  </div>
                )}
              </motion.div>
            );
          }
        )}
      </div>

      {/* Order CTA */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        disabled={selectedCount === 0 || loading || isComposing}
        onClick={handleOrderVarietyPack}
        className="w-full py-3.5 rounded-xl font-bold text-sm btn-gradient shadow-glow disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {isComposing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Composing sheet...
          </>
        ) : (
          <>
            <ShoppingCart size={16} />
            Order Variation Sheet ({selectedCount} stickers)
          </>
        )}
      </motion.button>

      <button
        onClick={onTryAnotherStyle}
        className="text-sm text-primary font-semibold text-center"
      >
        Try a different style instead
      </button>
    </div>
  );
}
