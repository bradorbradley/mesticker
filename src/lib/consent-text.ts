/**
 * The exact wording guests agree to on an event sign-up screen. The server logs this text with
 * each yes/no (guest_consents), so change the version when you change the words.
 */
export const CONSENT_VERSION = "2026-11-28b";

export const CONSENT_TEXT = {
  // shown as a line under the button, not a checkbox: continuing = agreeing
  terms:
    "By continuing I agree to the MeSticker Terms and Privacy Policy and confirm I'm 18 or older, or the parent or guardian of everyone in my photo.",
  media:
    "Feature me! MeSticker can post photos and videos of me from tonight, and my stickers, on social media and its website. I can say stop anytime.",
  marketing: "Email me more stickers, games and gifts made from my character. Unsubscribe anytime.",
} as const;

export type ConsentKind = keyof typeof CONSENT_TEXT;
