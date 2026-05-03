"use client";

/**
 * Minimal cart provider. The current single-page flow uses local state
 * in page.tsx, so this exists only to satisfy the layout-level provider
 * wrapper. Kept intentionally tiny — extend if you reintroduce a cart UI.
 */

import { createContext, useContext, type ReactNode } from "react";

type CartContextType = Record<string, never>;

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  return <CartContext.Provider value={{}}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
