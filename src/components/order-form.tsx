"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Check } from "lucide-react";
import { ShippingAddress } from "@/types";
import { cn } from "@/lib/utils";

interface OrderFormProps {
  onSubmit: (quantity: number, address: ShippingAddress) => void;
  isLoading?: boolean;
  className?: string;
}

// Each "sheet" = 6 kiss-cut stickers on a 5.83"×8.27" sheet
// Printful cost: $5.05/sheet + ~$4.50 shipping
// Pricing ensures minimum $5 profit per order
const PACKS = [
  { quantity: 1, price: 14.99, label: "1 Sheet", sublabel: "6 stickers", tag: null },
  { quantity: 2, price: 24.99, label: "2 Sheets", sublabel: "12 stickers", tag: "Most Popular" },
  { quantity: 3, price: 34.99, label: "3 Sheets", sublabel: "18 stickers", tag: "Best Value" },
];

const SHIPPING = 4.99;

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
  const subtotal = pack.price;
  const total = subtotal + SHIPPING;

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
            <p className="text-base font-bold">{p.label}</p>
            <p className="text-[10px] text-muted-foreground">{p.sublabel}</p>
            <p className="text-sm font-semibold text-primary mt-1">
              ${p.price.toFixed(2)}
            </p>
          </button>
        ))}
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
                {pack.label} ({pack.sublabel})
              </span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>${SHIPPING.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border font-semibold text-base">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
        {isLoading ? "Creating order..." : `Pay $${total.toFixed(2)}`}
      </Button>
    </form>
  );
}
