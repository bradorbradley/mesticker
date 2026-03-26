"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Package, Plus, Minus } from "lucide-react";
import { ShippingAddress, Creation, CartItem } from "@/types";
import { PACK_PRICE_CENTS } from "@/lib/stripe";
import { STICKERS_PER_PACK } from "@/lib/printful";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";

interface OrderFormProps {
  currentCreation: Creation | null;
  pastCreations: Creation[];
  onSubmit: (items: CartItem[], address: ShippingAddress) => void;
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
  // Build initial cart: current creation = 1 pack, everything else = 0
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    if (currentCreation) q[currentCreation.id] = 1;
    return q;
  });

  const [address, setAddress] = useState<ShippingAddress>({
    name: "",
    address1: "",
    address2: "",
    city: "",
    stateCode: "",
    countryCode: "US",
    zip: "",
  });

  // All unique creations (current first, then past — deduplicated)
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
    onSubmit(items, address);
  };

  const updateField = (field: keyof ShippingAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className={className} autoComplete="on">
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
              {/* Sticker thumbnail */}
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-border shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={creation.generatedImage}
                  alt={`Sticker ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {STICKERS_PER_PACK} kiss-cut stickers
                </p>
              </div>

              {/* +/- stepper */}
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

      {/* Shipping Address */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck size={16} /> Shipping Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              value={address.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div>
            <Label htmlFor="address1">Address</Label>
            <Input
              id="address1"
              name="address-line1"
              autoComplete="address-line1"
              required
              value={address.address1}
              onChange={(e) => updateField("address1", e.target.value)}
              placeholder="123 Main St"
            />
          </div>
          <div>
            <Label htmlFor="address2">Apt / Suite (optional)</Label>
            <Input
              id="address2"
              name="address-line2"
              autoComplete="address-line2"
              value={address.address2}
              onChange={(e) => updateField("address2", e.target.value)}
              placeholder="Apt 4B"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                autoComplete="address-level2"
                required
                value={address.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="New York"
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                autoComplete="address-level1"
                required
                value={address.stateCode}
                onChange={(e) => updateField("stateCode", e.target.value)}
                placeholder="NY"
                maxLength={2}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                name="postal-code"
                autoComplete="postal-code"
                required
                value={address.zip}
                onChange={(e) => updateField("zip", e.target.value)}
                placeholder="10001"
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                name="country"
                autoComplete="country"
                value={address.countryCode}
                onChange={(e) => updateField("countryCode", e.target.value)}
                placeholder="US"
                maxLength={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {totalPacks} {totalPacks === 1 ? "pack" : "packs"} ({totalStickers} stickers)
              </span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="text-green-600 font-semibold">FREE</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border font-semibold text-base">
              <span>Total</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isLoading || totalPacks === 0}
      >
        {isLoading
          ? "Creating order..."
          : totalPacks === 0
            ? "Select at least 1 pack"
            : `Pay $${totalPrice.toFixed(2)}`}
      </Button>
    </form>
  );
}
