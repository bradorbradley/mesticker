/** Booth settings shared by the kiosk UI and its API routes. */

/** Skip payment entirely (demos, free events). Staff can also toggle it in the operator panel. */
export const BOOTH_FREE_MODE = process.env.NEXT_PUBLIC_BOOTH_FREE_MODE === "1";

/** Sheets per Liene PixCut S1 cassette. */
export const SHEETS_PER_CASSETTE = 36;

/**
 * What a guest can buy. Every sheet is the PixCut S1's 4×7" sticker paper
 * (3.9×6.7" printable) laid out as 1 big (2.7") + 4 minis (1.8"); paper +
 * ribbon is ~$0.60/sheet. What changes is what goes on the sheet:
 *   same  — 5 of their sticker
 *   pose  — their sticker + 4 new poses of the same character (web app's
 *           variations engine designs poses for this person)
 *   style — their sticker + the same photo in the other 4 cartoon styles
 * Prices can be overridden with NEXT_PUBLIC_BOOTH_PRICES="sheet:2000,pose:2500,style:2500,party:4000".
 */
export type SheetKind = "same" | "pose" | "style";

export interface BoothProduct {
  id: "sheet" | "pose" | "style" | "party";
  name: string;
  blurb: string;
  priceCents: number;
  sheets: SheetKind[];
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

export const BOOTH_PRODUCTS: BoothProduct[] = (
  [
    { id: "sheet", name: "Sticker Sheet", blurb: "5 of your sticker", priceCents: 2000, sheets: ["same"], emoji: "✨" },
    { id: "pose", name: "Pose Pack", blurb: "You in 5 different poses", priceCents: 2500, sheets: ["pose"], tag: "New!", emoji: "🤸" },
    { id: "style", name: "Style Pack", blurb: "You in 5 cartoon styles", priceCents: 2500, sheets: ["style"], emoji: "🎨" },
    { id: "party", name: "Party Pack", blurb: "Poses + styles · 10 stickers", priceCents: 4000, sheets: ["pose", "style"], tag: "Best value", emoji: "🎉" },
  ] as BoothProduct[]
).map((p) => ({ ...p, priceCents: PRICE_OVERRIDES[p.id] ?? p.priceCents }));

export const DEFAULT_PRODUCT_ID: BoothProduct["id"] = "sheet";

export const getProduct = (id: string | null | undefined) => BOOTH_PRODUCTS.find((p) => p.id === id);

export const priceLabel = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** Lowest price, for the attract screen ("from $12"). */
export const BOOTH_FROM_LABEL = priceLabel(Math.min(...BOOTH_PRODUCTS.map((p) => p.priceCents)));
