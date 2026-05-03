/**
 * Centralized pricing for all SKUs.
 *
 * Two real products:
 *   1. Individual 3"x3" kiss-cut stickers — sold in packs of 5 minimum
 *   2. Sticker sheet (5.83"x8.27") — 6 stickers per sheet, sold by the sheet
 *
 * Prices are designed to clear at least $5 profit per order after Printful
 * cost (~$1.30/individual, ~$3.99/sheet), Printful shipping ($3.99-$4.99),
 * and Stripe fees (2.9% + $0.30).
 */

// 5.83x8.27 kiss-cut sticker sheet
export const VARIANT_KISS_CUT_SHEET = 12917;

// 3"x3" individual kiss-cut sticker.
// Override with PRINTFUL_VARIANT_INDIVIDUAL_3X3 env var.
export const VARIANT_INDIVIDUAL_3X3 = process.env.PRINTFUL_VARIANT_INDIVIDUAL_3X3
  ? Number(process.env.PRINTFUL_VARIANT_INDIVIDUAL_3X3)
  : 10163;

export type ProductType = "individual-pack" | "sticker-sheet";

export const INDIVIDUAL_PACK_TIERS = [
  { id: "ind-5", qty: 5, priceCents: 1499, label: "5 Stickers", subtitle: "$3.00 each" },
  { id: "ind-10", qty: 10, priceCents: 2499, label: "10 Stickers", subtitle: "$2.50 each", tag: "Most Popular" },
  { id: "ind-25", qty: 25, priceCents: 4999, label: "25 Stickers", subtitle: "$2.00 each", tag: "Best Value" },
] as const;

export const SHEET_TIERS = [
  { id: "sheet-1", qty: 1, priceCents: 1499, label: "1 Sheet", subtitle: "6 stickers" },
  { id: "sheet-2", qty: 2, priceCents: 2499, label: "2 Sheets", subtitle: "12 stickers", tag: "Save $5" },
  { id: "sheet-3", qty: 3, priceCents: 3499, label: "3 Sheets", subtitle: "18 stickers", tag: "Best Value" },
] as const;

export const SHIPPING_CENTS = 399;
export const FREE_SHIPPING_THRESHOLD_CENTS = 3500;

export function getShipping(subtotalCents: number): number {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
}

export function getTier(productType: ProductType, tierId: string) {
  const tiers = productType === "individual-pack" ? INDIVIDUAL_PACK_TIERS : SHEET_TIERS;
  return tiers.find((t) => t.id === tierId) ?? tiers[0];
}

export interface CartPricingItem {
  productType: ProductType;
  tierId: string;
}

export function calculateCartTotal(items: CartPricingItem[]): {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
} {
  let subtotalCents = 0;
  for (const item of items) {
    subtotalCents += getTier(item.productType, item.tierId).priceCents;
  }
  const shippingCents = getShipping(subtotalCents);
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}

export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function resolveFulfillment(
  productType: ProductType,
  tierId: string
): { variantId: number; quantity: number } {
  const tier = getTier(productType, tierId);
  return {
    variantId: productType === "individual-pack"
      ? VARIANT_INDIVIDUAL_3X3
      : VARIANT_KISS_CUT_SHEET,
    quantity: tier.qty,
  };
}
