/** Booth settings shared by the kiosk UI and its API routes. */

/** Skip payment entirely (demos, free events). Staff can also toggle it in the operator panel. */
export const BOOTH_FREE_MODE = process.env.NEXT_PUBLIC_BOOTH_FREE_MODE === "1";

/** Sheets per Liene PixCut S1 cassette. */
export const SHEETS_PER_CASSETTE = 36;

/**
 * What a guest can buy. Every sheet is the PixCut S1's 4×7" sticker paper
 * (3.9×6.7" printable) holding 8 stickers in the hand-arrangeable kit8
 * layout; paper + ribbon is ~$0.60/sheet. What changes is what goes on it:
 *   pose — their sticker + 7 new poses in the same style (poses designed for
 *          this person by the web app's variations engine). Started the moment
 *          the photo is taken, so they're ready by the reveal.
 *   same — their sticker 8 times, in different sizes
 *   mix  — their sticker + 7 that change pose AND style (made only if picked)
 * Staff then upload the 8 images one by one into the Liene app (which removes
 * each background) and arrange them like the numbered guide.
 * Prices can be overridden with NEXT_PUBLIC_BOOTH_PRICES="pose:2500,sheet:2000,mix:2500".
 */
export type SheetKind = "same" | "pose" | "mix";

export interface BoothProduct {
  id: "sheet" | "pose" | "mix";
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
    { id: "pose", name: "Pose Sheet", blurb: "You + 7 new poses · 8 stickers", priceCents: 2500, sheets: ["pose"], tag: "Most fun", emoji: "🤸" },
    { id: "sheet", name: "Sticker Sheet", blurb: "8 of your sticker, all sizes", priceCents: 2000, sheets: ["same"], emoji: "✨" },
    { id: "mix", name: "Mix Sheet", blurb: "7 poses, each a new style", priceCents: 2500, sheets: ["mix"], emoji: "🎨" },
  ] as BoothProduct[]
).map((p) => ({ ...p, priceCents: PRICE_OVERRIDES[p.id] ?? p.priceCents }));

export const DEFAULT_PRODUCT_ID: BoothProduct["id"] = "pose";

export const getProduct = (id: string | null | undefined) => BOOTH_PRODUCTS.find((p) => p.id === id);

export const priceLabel = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** Lowest price, for the attract screen ("from $12"). */
export const BOOTH_FROM_LABEL = priceLabel(Math.min(...BOOTH_PRODUCTS.map((p) => p.priceCents)));
