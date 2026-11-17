/** Booth settings shared by the kiosk UI and its API routes. */

/** Skip payment entirely (demos, free events). Staff can also toggle it in the operator panel. */
export const BOOTH_FREE_MODE = process.env.NEXT_PUBLIC_BOOTH_FREE_MODE === "1";

/** Sheets per PixCut S1 cassette. */
export const SHEETS_PER_CASSETTE = 36;

/** Every booth sticker is chibi for now (no style picker). */
export const BOOTH_STYLE = "chibi";

/**
 * The menu: three different 4×7" sheets (3.9×6.7" printable on the PixCut S1),
 * 12 stickers each, all made from the guest's one photo. Guests pick 1, 2 or 3.
 *   pose — their sticker + 7 new poses (designed for this person by the vision engine)
 *   face — their sticker + 7 expressions (laughing, wink, heart eyes…)
 *   best — a big hero + the best of both, mixed sizes
 * Poses and expressions both start the moment the photo is taken, so all
 * three sheets fill in during the reveal (15 image generations per guest).
 */
export type SheetKind = "pose" | "face" | "best";

export interface SheetDesign {
  id: SheetKind;
  name: string;
  blurb: string;
  emoji: string;
}

export const SHEET_DESIGNS: SheetDesign[] = [
  { id: "pose", name: "Pose Party", blurb: "You + 7 poses", emoji: "🤸" },
  { id: "face", name: "Big Feelings", blurb: "You + 7 expressions", emoji: "😆" },
  { id: "best", name: "Best Of", blurb: "Big you + the best of both", emoji: "⭐" },
];

/** Stickers on every sheet (see LAYOUTS.pack12). */
export const STICKERS_PER_SHEET = 12;

/**
 * Price by how many sheets: 1 / 2 / 3. Override with
 * NEXT_PUBLIC_BOOTH_BUNDLE_PRICES="1000,1800,2400" (cents).
 */
const DEFAULT_BUNDLE = [1000, 1800, 2400];
export const BUNDLE_PRICES: number[] = (() => {
  const parts = (process.env.NEXT_PUBLIC_BOOTH_BUNDLE_PRICES || "").split(",").map((s) => Math.round(Number(s.trim())));
  return parts.length === 3 && parts.every((c) => c > 0) ? parts : DEFAULT_BUNDLE;
})();

export const bundlePrice = (count: number) => BUNDLE_PRICES[Math.min(Math.max(count, 1), 3) - 1];

/** Validate a guest's picks: known sheets, no repeats, 1–3, in menu order. */
export function parseSheets(input: unknown): SheetKind[] {
  const picked = new Set(Array.isArray(input) ? input.map(String) : []);
  return SHEET_DESIGNS.map((d) => d.id).filter((id) => picked.has(id));
}

export const getSheet = (id: SheetKind) => SHEET_DESIGNS.find((d) => d.id === id)!;

export const priceLabel = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** For the attract screen ("from $10"). */
export const BOOTH_FROM_LABEL = priceLabel(BUNDLE_PRICES[0]);
