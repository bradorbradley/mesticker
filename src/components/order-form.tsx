"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Minus, Plus, Trash2, Mail, Gift, Sparkles } from "lucide-react";
import { ShippingAddress } from "@/types";

interface CartItemInput {
  generatedImage: string;
  originalImage: string;
  stylePreset: string;
  sheets: number;
  isVarietyPack?: boolean;
}

interface OrderFormProps {
  cartItems: CartItemInput[];
  onSubmit: (email: string, quantity: number, address: ShippingAddress) => void;
  isLoading?: boolean;
  className?: string;
}

// Pricing
const SHEET_PRICES: Record<number, number> = {
  1: 19.99,
  2: 34.99,
  3: 49.99,
};
const PER_SHEET_FALLBACK = 15.99;
const HOLOGRAPHIC_UPGRADE = 5.0;
const SHIPPING = 4.99;
const FREE_SHIPPING_THRESHOLD = 35;

export default function OrderForm({
  cartItems: initialItems,
  onSubmit,
  isLoading,
  className,
}: OrderFormProps) {
  const [items, setItems] = useState(
    initialItems.map((item, i) => ({
      ...item,
      id: `item-${i}`,
      skuId: "kiss-cut-sheet" as string,
    }))
  );
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<ShippingAddress>({
    name: "",
    address1: "",
    address2: "",
    city: "",
    stateCode: "",
    countryCode: "US",
    zip: "",
  });

  const updateField = (field: keyof ShippingAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const updateItemSheets = (id: string, sheets: number) => {
    if (sheets < 1) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, sheets } : i)));
  };

  const updateItemSku = (id: string, skuId: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, skuId } : i)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Calculate totals
  const totalSheets = items.reduce((s, i) => s + i.sheets, 0);
  const subtotal = items.reduce((total, item) => {
    const base = SHEET_PRICES[item.sheets] ?? item.sheets * PER_SHEET_FALLBACK;
    const holo = item.skuId === "holographic-sheet" ? HOLOGRAPHIC_UPGRADE * item.sheets : 0;
    return total + base + holo;
  }, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : items.length > 0 ? SHIPPING : 0;
  const grandTotal = subtotal + shipping;

  // AOV nudge
  const showAddOneMore = items.length === 1 && items[0].sheets === 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, totalSheets, address);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      autoComplete="on"
      name="shipping"
    >
      {/* Cart Items */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Stickers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="space-y-2 pb-3 border-b border-border last:border-0 last:pb-0">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.generatedImage}
                  alt="Sticker"
                  className="w-14 h-14 rounded-lg object-contain bg-muted"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground capitalize truncate">
                    {item.isVarietyPack ? "Variety pack" : `${item.stylePreset} style`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.sheets} {item.sheets === 1 ? "sheet" : "sheets"} ({item.sheets * 6} stickers)
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateItemSheets(item.id, item.sheets - 1)}
                    disabled={item.sheets <= 1}
                    className="w-7 h-7 rounded-full border border-border flex items-center justify-center disabled:opacity-30"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">
                    {item.sheets}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateItemSheets(item.id, item.sheets + 1)}
                    className="w-7 h-7 rounded-full border border-border flex items-center justify-center"
                  >
                    <Plus size={12} />
                  </button>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 ml-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              {/* SKU selector */}
              <div className="flex gap-1.5 ml-[68px]">
                <button
                  type="button"
                  onClick={() => updateItemSku(item.id, "kiss-cut-sheet")}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                    item.skuId === "kiss-cut-sheet"
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => updateItemSku(item.id, "holographic-sheet")}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    item.skuId === "holographic-sheet"
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <Sparkles size={8} />
                  Holographic +$5
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No stickers in cart
            </p>
          )}
        </CardContent>
      </Card>

      {/* AOV nudge */}
      {showAddOneMore && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-center"
        >
          <p className="text-xs font-semibold">
            <Gift size={12} className="inline mr-1" />
            Add 1 more sheet for just $15 more (save $5)
          </p>
          <button
            type="button"
            onClick={() => updateItemSheets(items[0].id, 2)}
            className="mt-1.5 text-xs text-primary font-bold underline"
          >
            Upgrade to 2-pack
          </button>
        </motion.div>
      )}

      {/* Email */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div>
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail size={14} /> Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              We&apos;ll save your creations so you can reorder anytime
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Shipping */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck size={16} /> Shipping Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="shipping-name">Full Name</Label>
            <Input
              id="shipping-name"
              name="shipping-name"
              autoComplete="name"
              required
              value={address.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div>
            <Label htmlFor="shipping-address1">Address</Label>
            <Input
              id="shipping-address1"
              name="shipping-address-line1"
              autoComplete="address-line1"
              required
              value={address.address1}
              onChange={(e) => updateField("address1", e.target.value)}
              placeholder="123 Main St"
            />
          </div>
          <div>
            <Label htmlFor="shipping-address2">Apt / Suite (optional)</Label>
            <Input
              id="shipping-address2"
              name="shipping-address-line2"
              autoComplete="address-line2"
              value={address.address2}
              onChange={(e) => updateField("address2", e.target.value)}
              placeholder="Apt 4B"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="shipping-city">City</Label>
              <Input
                id="shipping-city"
                name="shipping-city"
                autoComplete="address-level2"
                required
                value={address.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="New York"
              />
            </div>
            <div>
              <Label htmlFor="shipping-state">State</Label>
              <Input
                id="shipping-state"
                name="shipping-state"
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
              <Label htmlFor="shipping-zip">ZIP Code</Label>
              <Input
                id="shipping-zip"
                name="shipping-postal-code"
                autoComplete="postal-code"
                inputMode="numeric"
                required
                value={address.zip}
                onChange={(e) => updateField("zip", e.target.value)}
                placeholder="10001"
              />
            </div>
            <div>
              <Label htmlFor="shipping-country">Country</Label>
              <Input
                id="shipping-country"
                name="shipping-country"
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
                {totalSheets} {totalSheets === 1 ? "sheet" : "sheets"} ({totalSheets * 6} stickers)
              </span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>
                {shipping === 0 ? (
                  <span className="text-green-600 font-semibold">FREE</span>
                ) : (
                  `$${shipping.toFixed(2)}`
                )}
              </span>
            </div>
            {shipping === 0 && (
              <p className="text-[10px] text-green-600 text-right">
                Free shipping on orders over $35
              </p>
            )}
            <div className="flex justify-between pt-2 border-t border-border font-semibold text-base">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isLoading || items.length === 0}
      >
        {isLoading ? "Creating order..." : `Pay $${grandTotal.toFixed(2)}`}
      </Button>
    </form>
  );
}
