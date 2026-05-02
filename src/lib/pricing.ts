/**
 * Centralized pricing for all SKUs.
 * Prices in cents for Stripe, display helpers in dollars.
 */

export interface SkuOption {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  printfulVariantId: number;
  /** Additional cost on top of base (e.g. holographic upgrade) */
  addonCents?: number;
}

// Printful variant IDs
export const VARIANT_KISS_CUT_SHEET = 12917; // 5.83"×8.27" kiss-cut sticker sheet
export const VARIANT_HOLOGRAPHIC_SHEET = 13032; // holographic kiss-cut sticker sheet (same size)

export const SKU_OPTIONS: SkuOption[] = [
  {
    id: "kiss-cut-sheet",
    name: "Kiss-Cut Sheet",
    description: "6 stickers on a 5.83×8.27\" sheet",
    priceCents: 1999, // $19.99
    printfulVariantId: VARIANT_KISS_CUT_SHEET,
  },
  {
    id: "holographic-sheet",
    name: "Holographic Sheet",
    description: "6 holographic stickers — extra shine",
    priceCents: 2499, // $24.99 ($19.99 + $5 upgrade)
    printfulVariantId: VARIANT_HOLOGRAPHIC_SHEET,
    addonCents: 500,
  },
];

// Quantity pricing tiers (cents)
export const QUANTITY_TIERS = [
  { qty: 1, priceCents: 1999, label: "1 Sheet", sublabel: "6 stickers" },
  { qty: 2, priceCents: 3499, label: "2 Sheets", sublabel: "12 stickers", tag: "Save $5" },
  { qty: 3, priceCents: 4999, label: "3 Sheets", sublabel: "18 stickers", tag: "Best Value" },
] as const;

export const SHIPPING_CENTS = 499; // $4.99
export const FREE_SHIPPING_THRESHOLD_CENTS = 3500; // free over $35

export function getShipping(subtotalCents: number): number {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
}

export function calculateCartTotal(items: { skuId: string; quantity: number }[]): {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
} {
  let subtotalCents = 0;
  for (const item of items) {
    const sku = SKU_OPTIONS.find((s) => s.id === item.skuId);
    if (!sku) continue;
    // Use tier pricing for quantity
    const tier = QUANTITY_TIERS.find((t) => t.qty === item.quantity);
    if (tier) {
      const holoUpgrade = sku.addonCents ? sku.addonCents * item.quantity : 0;
      subtotalCents += tier.priceCents + holoUpgrade;
    } else {
      subtotalCents += sku.priceCents * item.quantity;
    }
  }
  const shippingCents = getShipping(subtotalCents);
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
