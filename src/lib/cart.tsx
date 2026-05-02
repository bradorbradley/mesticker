"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface CartItem {
  id: string;
  generatedImage: string;
  originalImage: string;
  stylePreset: string;
  sheets: number;
  skuId: string;
  isVarietyPack?: boolean;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id" | "sheets" | "skuId"> & { sheets?: number; skuId?: string }) => void;
  removeItem: (id: string) => void;
  updateSheets: (id: string, sheets: number) => void;
  updateSku: (id: string, skuId: string) => void;
  clearCart: () => void;
  totalSheets: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

// Pricing
const SHEET_PRICES_CENTS: Record<number, number> = {
  1: 1999, // $19.99
  2: 3499, // $34.99
  3: 4999, // $49.99
};
const PER_SHEET_FALLBACK_CENTS = 1599; // $15.99/ea for 4+
const HOLOGRAPHIC_UPGRADE_CENTS = 500; // +$5.00 per sheet
const SHIPPING_CENTS = 499; // $4.99
const FREE_SHIPPING_THRESHOLD = 3500; // $35

function calculateSubtotal(items: CartItem[]): number {
  let total = 0;
  for (const item of items) {
    const basePrice = SHEET_PRICES_CENTS[item.sheets] ?? item.sheets * PER_SHEET_FALLBACK_CENTS;
    const holoUpgrade = item.skuId === "holographic-sheet" ? HOLOGRAPHIC_UPGRADE_CENTS * item.sheets : 0;
    total += basePrice + holoUpgrade;
  }
  return total;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: Omit<CartItem, "id" | "sheets" | "skuId"> & { sheets?: number; skuId?: string }) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.generatedImage === item.generatedImage);
      if (existing) {
        return prev.map((i) =>
          i.id === existing.id ? { ...i, sheets: i.sheets + (item.sheets || 1) } : i
        );
      }
      const id = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return [...prev, { ...item, id, sheets: item.sheets || 1, skuId: item.skuId || "kiss-cut-sheet" }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateSheets = useCallback((id: string, sheets: number) => {
    if (sheets < 1) return;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, sheets } : i))
    );
  }, []);

  const updateSku = useCallback((id: string, skuId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, skuId } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalSheets = items.reduce((sum, i) => sum + i.sheets, 0);
  const subtotalCents = calculateSubtotal(items);
  const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : (items.length > 0 ? SHIPPING_CENTS : 0);
  const totalCents = subtotalCents + shippingCents;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateSheets,
        updateSku,
        clearCart,
        totalSheets,
        subtotalCents,
        shippingCents,
        totalCents,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
