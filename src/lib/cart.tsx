"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface CartItem {
  id: string;
  generatedImage: string;
  originalImage: string;
  stylePreset: string;
  sheets: number; // number of sheets (each sheet = 6 stickers)
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id" | "sheets">) => void;
  removeItem: (id: string) => void;
  updateSheets: (id: string, sheets: number) => void;
  clearCart: () => void;
  totalSheets: number;
  totalPrice: number;
  shipping: number;
  grandTotal: number;
}

// Pricing: $14.99 per sheet, $4.99 flat shipping
const PRICE_PER_SHEET = 14.99;
const SHIPPING = 4.99;

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: Omit<CartItem, "id" | "sheets">) => {
    const id = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItems((prev) => [...prev, { ...item, id, sheets: 1 }]);
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

  const clearCart = useCallback(() => setItems([]), []);

  const totalSheets = items.reduce((sum, i) => sum + i.sheets, 0);
  const totalPrice = totalSheets * PRICE_PER_SHEET;
  const shipping = items.length > 0 ? SHIPPING : 0;
  const grandTotal = totalPrice + shipping;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateSheets,
        clearCart,
        totalSheets,
        totalPrice,
        shipping,
        grandTotal,
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
