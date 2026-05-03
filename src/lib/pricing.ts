/**
 * Centralized pricing for all SKUs.
 * Prices in cents for Stripe, display helpers in dollars.
 */

// Printful variant IDs
export const VARIANT_KISS_CUT_SHEET = 12917; // 5.83"x8.27" kiss-cut sticker sheet
export const VARIANT_HOLOGRAPHIC_SHEET = 13032; // holographic kiss-cut sticker sheet (same size)

// --- Sticker Pack tiers ---
export const STICKER_PACK_TIERS = [
  { id: "pack-10", qty: 10, sheets: 2, priceCents: 1999, label: "10+ Stickers" },
  { id: "pack-25", qty: 25, sheets: 5, priceCents: 3499, label: "25+ Stickers", tag: "Most Popular" },
  { id: "pack-50", qty: 50, sheets: 9, priceCents: 5999, label: "50+ Stickers", tag: "Best Value" },
] as const;

// --- Variation Sheet pricing ---
export const VARIATION_SHEET_PRICE_CENTS = 1499; // $14.99

// --- Shipping ---
export const SHIPPING_CENTS = 499; // $4.99
export const FREE_SHIPPING_THRESHOLD_CENTS = 3000; // Free shipping over $30

export function getShipping(subtotalCents: number): number {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
}

export type ProductType = "sticker-pack" | "variation-sheet";

export interface CartPricingItem {
  productType: ProductType;
  tierId?: string; // for sticker packs
}

export function calculateCartTotal(items: CartPricingItem[]): {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
} {
  let subtotalCents = 0;
  for (const item of items) {
    if (item.productType === "sticker-pack") {
      const tier = STICKER_PACK_TIERS.find((t) => t.id === item.tierId);
      subtotalCents += tier ? tier.priceCents : STICKER_PACK_TIERS[0].priceCents;
    } else if (item.productType === "variation-sheet") {
      subtotalCents += VARIATION_SHEET_PRICE_CENTS;
    }
  }
  const shippingCents = getShipping(subtotalCents);
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
