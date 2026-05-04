"use client";

/**
 * Cart with parent/child sheet hierarchy.
 *
 * One product type — the kiss-cut sticker sheet (variant 12917).
 * Two layouts (item kinds):
 *   - "variations": 6 different poses of the character on one sheet
 *   - "single":     6 of one specific design on one sheet
 *
 * Pricing: $14.99 first sheet, $9.99 each additional. Free US shipping.
 * Volume gives the user a reason to add more, supporting the "I love
 * the bottom-left tile, give me a sheet of just THAT" flow.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

export type CartItemKind = "variations" | "single" | "original";

export interface CartItem {
  id: string;
  kind: CartItemKind;
  composedImage: string; // low-res sheet for preview / fallback only
  thumbnail: string;     // small representative image for cart display
  label: string;         // user-facing name

  // For HQ regen at print time. The webhook regenerates each prompt at
  // quality:high using sourceCartoon as input, recomposes the sheet, then
  // sends THAT to Printful instead of the low-res composedImage.
  // Empty prompts = no regen (use composedImage as-is, e.g. original sheet).
  sourceCartoon?: string;
  prompts?: string[];
}

interface CartCtx {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  count: number;
  subtotalCents: number;
  totalCents: number;
}

export const FIRST_SHEET_CENTS = 1499;
export const ADDITIONAL_SHEET_CENTS = 999;

function calculateSubtotal(count: number): number {
  if (count <= 0) return 0;
  return FIRST_SHEET_CENTS + Math.max(0, count - 1) * ADDITIONAL_SHEET_CENTS;
}

const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    setItems((prev) => [
      ...prev,
      { ...item, id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const subtotalCents = useMemo(() => calculateSubtotal(items.length), [items.length]);
  const totalCents = subtotalCents; // free shipping baked in

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clear,
        count: items.length,
        subtotalCents,
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

export function pricePreview(count: number): number {
  return calculateSubtotal(count);
}
