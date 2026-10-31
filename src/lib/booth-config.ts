/** Booth settings shared by the kiosk UI and its API routes. */

/** Skip payment entirely (demos, free events). Staff can also toggle it in the operator panel. */
export const BOOTH_FREE_MODE = process.env.NEXT_PUBLIC_BOOTH_FREE_MODE === "1";

/** Sheets per Liene PixCut S1 cassette. */
export const SHEETS_PER_CASSETTE = 36;

/**
 * What a guest can buy, sized to the PixCut S1's 4×7" sheet (3.9×6.7"
 * printable). Each sheet costs ~$0.60 in paper + ribbon.
 *   big   — one 3.7" sticker on its own sheet
 *   sheet — 1 big (2.7") + 4 small (1.8") on one sheet
 * Prices can be overridden with NEXT_PUBLIC_BOOTH_PRICES="big:1200,sheet:2000,party:3000".
 */
export type PrintLayout = "big" | "sheet";

export interface BoothProduct {
  id: "big" | "sheet" | "party";
  name: string;
  blurb: string;
  priceCents: number;
  sheets: number;
  layout: PrintLayout;
  tag?: string;
  emoji: string;
}

const PRICE_OVERRIDES = Object.fromEntries(
  (process.env.NEXT_PUBLIC_BOOTH_PRICES || "")
    .split(",")
    .map((p) => p.split(":").map((s) => s.trim()))
    .filter(([id, cents]) => id && Number(cents) > 0)
    .map(([id, cents]) => [id, Math.round(Number(cents))])
) as Record<string, number>;

export const BOOTH_PRODUCTS: BoothProduct[] = [
  { id: "big", name: "Big Sticker", blurb: "One big 3.7\" sticker", priceCents: 1200, sheets: 1, layout: "big", emoji: "⭐" },
  { id: "sheet", name: "Sticker Sheet", blurb: "5 stickers: 1 big + 4 minis", priceCents: 2000, sheets: 1, layout: "sheet", tag: "Most popular", emoji: "✨" },
  { id: "party", name: "Party Pack", blurb: "2 sheets · 10 stickers to share", priceCents: 3000, sheets: 2, layout: "sheet", tag: "Best value", emoji: "🎉" },
].map((p) => ({ ...p, priceCents: PRICE_OVERRIDES[p.id] ?? p.priceCents })) as BoothProduct[];

export const DEFAULT_PRODUCT_ID: BoothProduct["id"] = "sheet";

export const getProduct = (id: string | null | undefined) => BOOTH_PRODUCTS.find((p) => p.id === id);

export const priceLabel = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** Lowest price, for the attract screen ("from $12"). */
export const BOOTH_FROM_LABEL = priceLabel(Math.min(...BOOTH_PRODUCTS.map((p) => p.priceCents)));
