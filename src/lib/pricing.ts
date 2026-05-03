/**
 * Centralized pricing. ONE product: kiss-cut sticker sheet (5.83x8.27),
 * sold in 1/2/3-pack tiers. Free US shipping baked in.
 *
 * Two flavors of sheet (same Printful SKU, different image content):
 *   - "pack" = sheet of 6 character variations
 *   - "stack" = sheet of 6 copies of the same sticker
 *
 * Pricing clears $5+ profit/order after Printful (~$5/sheet wholesale),
 * shipping (~$3.99 inbound to us), and Stripe fees (2.9% + $0.30).
 */

export const VARIANT_KISS_CUT_SHEET = 12917; // 5.83x8.27 kiss-cut sheet

export type ProductType = "sticker-sheet";
export type SheetVariant = "pack" | "stack";

export const SHEET_TIERS = [
  { id: "sheet-1", qty: 1, priceCents: 1499, label: "1 Sheet", subtitle: "6 stickers" },
  { id: "sheet-2", qty: 2, priceCents: 2499, label: "2 Sheets", subtitle: "12 stickers", tag: "Save $5" },
  { id: "sheet-3", qty: 3, priceCents: 3499, label: "3 Sheets", subtitle: "18 stickers", tag: "Best Value" },
] as const;

// Free US shipping baked into the price. No threshold logic — just always free.
export function getShipping(): number {
  return 0;
}

export function getTier(tierId: string) {
  return SHEET_TIERS.find((t) => t.id === tierId) ?? SHEET_TIERS[0];
}

export interface CartPricingItem {
  tierId: string;
}

export function calculateCartTotal(items: CartPricingItem[]): {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
} {
  const subtotalCents = items.reduce(
    (sum, i) => sum + getTier(i.tierId).priceCents,
    0
  );
  const shippingCents = getShipping();
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}

export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function resolveFulfillment(tierId: string): {
  variantId: number;
  quantity: number;
} {
  return {
    variantId: VARIANT_KISS_CUT_SHEET,
    quantity: getTier(tierId).qty,
  };
}
