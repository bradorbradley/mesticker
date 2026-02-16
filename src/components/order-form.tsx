"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Check, Package } from "lucide-react";
import { ShippingAddress } from "@/types";
import { cn } from "@/lib/utils";

interface OrderFormProps {
  onSubmit: (quantity: number, address: ShippingAddress) => void;
  isLoading?: boolean;
  className?: string;
}

const PACKS = [
  { quantity: 3,  totalPrice: 19.99, label: "3 Pack",  tag: null,           save: null },
  { quantity: 5,  totalPrice: 29.99, label: "5 Pack",  tag: "Most Popular", save: "Save 10%" },
  { quantity: 10, totalPrice: 49.99, label: "10 Pack", tag: "Best Value",   save: "Save 25%" },
];

export default function OrderForm({ onSubmit, isLoading, className }: OrderFormProps) {
  const [selectedPack, setSelectedPack] = useState(1); // default to 5-pack

  const [address, setAddress] = useState<ShippingAddress>({
    name: "",
    address1: "",
    address2: "",
    city: "",
    stateCode: "",
    countryCode: "US",
    zip: "",
  });

  const pack = PACKS[selectedPack];
  const perSticker = pack.totalPrice / pack.quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(pack.quantity, address);
  };

  const updateField = (field: keyof ShippingAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {/* Pack Selector */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {PACKS.map((p, i) => (
          <button
            key={p.quantity}
            type="button"
            onClick={() => setSelectedPack(i)}
            className={cn(
              "relative rounded-xl border-2 p-3 text-center transition-all",
              selectedPack === i
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/40"
            )}
          >
            {p.tag && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                {p.tag}
              </span>
            )}
            {selectedPack === i && (
              <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <Check size={10} className="text-white" />
              </div>
            )}
            <p className="text-lg font-bold">{p.quantity}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">stickers</p>
            <p className="text-sm font-bold mt-1">${p.totalPrice.toFixed(2)}</p>
            {p.save && (
              <p className="text-[10px] font-semibold text-green-600 mt-0.5">{p.save}</p>
            )}
          </button>
        ))}
      </div>

      {/* Free Shipping Banner */}
      <div className="flex items-center justify-center gap-2 py-2 mb-4 rounded-xl bg-green-50 border border-green-200 text-green-700">
        <Package size={14} />
        <span className="text-xs font-semibold">Free shipping on all orders</span>
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
                {pack.quantity} stickers @ ${perSticker.toFixed(2)}/ea
              </span>
              <span>${pack.totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="text-green-600 font-semibold">FREE</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border font-semibold text-base">
              <span>Total</span>
              <span>${pack.totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
        {isLoading ? "Creating order..." : `Pay $${pack.totalPrice.toFixed(2)}`}
      </Button>
    </form>
  );
}
