/**
 * Booked events with their own booth link (mesticker.fun/booth/<slug>).
 *
 * free: the host prepaid, so guests never pay; orders print as soon as they're made.
 * collectGuest: before the camera, guests give an email (their stickers are emailed to them)
 * and see the consent checkboxes (terms, media release, marketing).
 * theme/style: fed to the image model like the staff panel's event settings.
 */
export interface PartyEvent {
  slug: string;
  name: string;
  /** shown on the sign-up screen, e.g. "December 12" */
  when?: string;
  free: boolean;
  collectGuest: boolean;
  theme?: string;
  style?: string;
  /** most orders one guest can make at this event */
  maxOrdersPerGuest: number;
}

export const PARTY_EVENTS: Record<string, PartyEvent> = {
  christmascarol: {
    slug: "christmascarol",
    name: "Christmas Carol Party",
    free: true,
    collectGuest: true,
    theme: "Christmas carol party: cozy winter scarf, Santa hat or reindeer antlers, holding a candle or a carol songbook, snowflakes",
    maxOrdersPerGuest: 3,
  },
};

export const getPartyEvent = (slug: unknown): PartyEvent | null => (typeof slug === "string" && PARTY_EVENTS[slug]) || null;
