/**
 * The exact wording guests agree to on an event sign-up screen. The server logs this text with
 * each yes/no (guest_consents), so change the version when you change the words.
 */
export const CONSENT_VERSION = "2026-11-28";

export const CONSENT_TEXT = {
  terms:
    "I agree to the MeSticker Terms and Privacy Policy, and I'm 18 or older (or I'm the parent or guardian of everyone in my photo and agree for them).",
  media:
    "Feature me! MeSticker may photograph and film me at this event and use those photos and videos, my photo and my stickers on social media, its website and ads, without payment. I can withdraw this anytime for future posts.",
  marketing: "Email me new sticker drops, games and products made from my character. Unsubscribe anytime.",
} as const;

export type ConsentKind = keyof typeof CONSENT_TEXT;
