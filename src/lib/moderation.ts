/**
 * Content moderation for custom style prompts.
 * Two layers: local banned terms + OpenAI moderation API.
 */

import OpenAI from "openai";

const BANNED_TERMS = [
  "nude", "naked", "nsfw", "porn", "sex", "erotic", "hentai",
  "gore", "blood", "murder", "kill", "violence", "weapon", "gun",
  "drug", "cocaine", "heroin", "meth",
  "hate", "racist", "nazi", "slur",
  "child abuse", "pedophil",
  "terrorist", "bomb", "explosion",
];

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

/** Fast local check against banned terms */
function checkBannedTerms(prompt: string): ModerationResult {
  const lower = prompt.toLowerCase();
  for (const term of BANNED_TERMS) {
    if (lower.includes(term)) {
      return { allowed: false, reason: "banned_term" };
    }
  }
  return { allowed: true };
}

/** Full moderation: local check + OpenAI moderation API */
export async function moderatePrompt(prompt: string): Promise<ModerationResult> {
  // Layer 1: local banned terms (instant)
  const localCheck = checkBannedTerms(prompt);
  if (!localCheck.allowed) return localCheck;

  // Layer 2: OpenAI moderation API (async, more nuanced)
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });
    const moderation = await openai.moderations.create({ input: prompt });
    const result = moderation.results[0];
    if (result?.flagged) {
      return { allowed: false, reason: "content_policy" };
    }
  } catch {
    // If moderation API fails, allow through (local check already passed)
  }

  return { allowed: true };
}
