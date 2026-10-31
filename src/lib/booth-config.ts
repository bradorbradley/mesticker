/** Booth settings shared by the kiosk UI and its API routes. */

export const BOOTH_PRICE_CENTS =
  parseInt(process.env.NEXT_PUBLIC_BOOTH_PRICE_CENTS || "2000", 10) || 2000;

export const BOOTH_PRICE_LABEL = `$${(BOOTH_PRICE_CENTS / 100).toFixed(BOOTH_PRICE_CENTS % 100 ? 2 : 0)}`;

/** Skip payment entirely (demos, free events). Staff can also toggle it in the operator panel. */
export const BOOTH_FREE_MODE = process.env.NEXT_PUBLIC_BOOTH_FREE_MODE === "1";

/** Sheets per Liene PixCut S1 cassette. */
export const SHEETS_PER_CASSETTE = 36;

/** Stickers on each printed sheet (1 big + 4 small). */
export const STICKERS_PER_SHEET = 5;
