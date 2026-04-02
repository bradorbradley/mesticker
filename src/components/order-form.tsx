"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Package, Plus, Minus } from "lucide-react";
import { Creation, CartItem } from "@/types";
import { PACK_PRICE_CENTS } from "@/lib/stripe";
import { STICKERS_PER_PACK } from "@/lib/printful";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";

interface OrderFormProps {
  currentCreation: Creation | null;
  pastCreations: Creation[];
  onSubmit: (items: CartItem[]) => void;
  isLoading?: boolean;
  className?: string;
}

const packPrice = PACK_PRICE_CENTS / 100;

export default function OrderForm({
  currentCreation,
  pastCreations,
  onSubmit,
  isLoading,
  className,
}: OrderFormProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    if (currentCreation) q[currentCreation.id] = 1;
    return q;
  });

  const allCreations = useMemo(() => {
    const seen = new Set<string>();
    const result: Creation[] = [];
    if (currentCreation) {
      seen.add(currentCreation.id);
      result.push(currentCreation);
    }
    for (const c of pastCreations) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        result.push(c);
      }
    }
    return result;
  }, [currentCreation, pastCreations]);

  const setQty = (id: string, delta: number) => {
    hapticLight();
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, Math.min(10, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const totalPacks = Object.values(quantities).reduce((sum, q) => sum + q, 0);
  const totalPrice = totalPacks * packPrice;
  const totalStickers = totalPacks * STICKERS_PER_PACK;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items: CartItem[] = allCreations
      .filter((c) => (quantities[c.id] || 0) > 0)
      .map((c) => ({
        creationId: c.id,
        imageUrl: c.imageUrl,
        generatedImage: c.generatedImage,
        stylePreset: c.stylePreset,
        packs: quantities[c.id],
      }));
    onSubmit(items);
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {/* Sticker selection with quantity steppers */}
      <div className="space-y-2 mb-4">
        {allCreations.map((creation, i) => {
          const qty = quantities[creation.id] || 0;
          return (
            <div
              key={creation.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                qty > 0
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border"
              )}
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-border shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={creation.generatedImage}
                  alt={`Sticker ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {STICKERS_PER_PACK} kiss-cut stickers
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQty(creation.id, -1)}
                  disabled={qty === 0}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    qty > 0
                      ? "bg-muted hover:bg-muted-foreground/20 text-foreground"
                      : "bg-muted/50 text-muted-foreground/40"
                  )}
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center text-sm font-bold tabular-nums">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(creation.id, 1)}
                  disabled={qty >= 10}
                  className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-all"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pack info banner */}
      <div className="flex items-center justify-center gap-2 py-2 mb-4 rounded-xl bg-green-50 border border-green-200 text-green-700">
        <Package size={14} />
        <span className="text-xs font-semibold">
          ${packPrice.toFixed(2)}/pack &middot; {STICKERS_PER_PACK} kiss-cut stickers &middot; Free shipping
        </span>
      </div>

      {/* Summary + checkout button */}
      {totalPacks > 0 && (
        <div className="text-center text-sm text-muted-foreground mb-3">
          {totalPacks} {totalPacks === 1 ? "pack" : "packs"} ({totalStickers} stickers) &middot; <span className="font-semibold text-foreground">${totalPrice.toFixed(2)}</span>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isLoading || totalPacks === 0}
      >
        {isLoading
          ? "Loading checkout..."
          : totalPacks === 0
            ? "Select at least 1 pack"
            : `Checkout · $${totalPrice.toFixed(2)}`}
      </Button>
    </form>
  );
}
