"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Minus, Plus, Trash2, Mail } from "lucide-react";
import { ShippingAddress } from "@/types";
import { useCart } from "@/lib/cart";

interface OrderFormProps {
  onSubmit: (email: string, quantity: number, address: ShippingAddress) => void;
  isLoading?: boolean;
  className?: string;
}

const SHIPPING = 4.99;

export default function OrderForm({ onSubmit, isLoading, className }: OrderFormProps) {
  const { items, updateSheets, removeItem, totalSheets, totalPrice, grandTotal } = useCart();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, totalSheets, address);
  };

  const updateField = (field: keyof ShippingAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className={className} autoComplete="on" name="shipping">
      {/* Cart Items */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Stickers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.generatedImage}
                alt="Sticker"
                className="w-14 h-14 rounded-lg object-contain bg-muted"
              />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground capitalize">{item.stylePreset} style</p>
                <p className="text-xs text-muted-foreground">{item.sheets} {item.sheets === 1 ? 'sheet' : 'sheets'} ({item.sheets * 6} stickers)</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateSheets(item.id, item.sheets - 1)}
                  disabled={item.sheets <= 1}
                  className="w-7 h-7 rounded-full border border-border flex items-center justify-center disabled:opacity-30"
                >
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center text-sm font-semibold">{item.sheets}</span>
                <button
                  type="button"
                  onClick={() => updateSheets(item.id, item.sheets + 1)}
                  className="w-7 h-7 rounded-full border border-border flex items-center justify-center"
                >
                  <Plus size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 ml-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">No stickers in cart</p>
          )}
        </CardContent>
      </Card>

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
              name="address1"
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
              name="address2"
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
                name="zip"
                autoComplete="postal-code"
                inputMode="numeric"
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
                {totalSheets} {totalSheets === 1 ? 'sheet' : 'sheets'} ({totalSheets * 6} stickers)
              </span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>${SHIPPING.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border font-semibold text-base">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={isLoading || items.length === 0}>
        {isLoading ? "Creating order..." : `Pay $${grandTotal.toFixed(2)}`}
      </Button>
    </form>
  );
}
