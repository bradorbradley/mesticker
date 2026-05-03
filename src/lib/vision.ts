/**
 * Vision pass: extract subject features from the captured photo so the
 * variations API can produce contextually-aware prompts (glasses,
 * beard, hat, age range, pet, accessories).
 *
 * Uses OpenAI's gpt-4o-mini vision — cheap (~$0.001 per call), fast,
 * and runs once per generation. Result is cached on the variations
 * payload so we only ever pay for one vision call per session.
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

export interface SubjectContext {
  subject: "person" | "child" | "pet-dog" | "pet-cat" | "group" | "other";
  hairColor?: string;
  hairStyle?: string;
  facialHair?: string;
  glasses?: boolean;
  hat?: string;
  notableAccessories?: string[];
  notableClothing?: string;
  vibe?: string; // free-form descriptor: "professional", "casual", "playful", etc.
}

const SYSTEM_PROMPT = `You analyze portrait photos to inform sticker generation. Return ONLY valid JSON matching this schema:

{
  "subject": "person" | "child" | "pet-dog" | "pet-cat" | "group" | "other",
  "hairColor": string (optional),
  "hairStyle": string (optional, e.g. "short curly", "long straight", "buzz cut"),
  "facialHair": string (optional, e.g. "beard", "mustache", "goatee", "clean-shaven"),
  "glasses": boolean (optional),
  "hat": string (optional, e.g. "baseball cap", "beanie"),
  "notableAccessories": string[] (optional, e.g. ["earbuds", "necklace"]),
  "notableClothing": string (optional, e.g. "blue hoodie", "business suit"),
  "vibe": string (optional, one word: "professional" | "casual" | "playful" | "rugged" | "elegant" | "athletic")
}

Be specific but concise. Only include fields you're confident about. Skip anything ambiguous.`;

export async function extractSubjectContext(
  imageBase64: string
): Promise<SubjectContext | null> {
  try {
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 250,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this photo for sticker generation context." },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text) as SubjectContext;
    return parsed;
  } catch (err) {
    console.error("[vision] extractSubjectContext failed:", err);
    return null;
  }
}

/**
 * Build context-aware variation descriptors. Takes the 9 base descriptors
 * and tweaks them based on what we see in the photo. The character itself
 * is locked from the cartoon — these prompts mostly add accessories,
 * caption text, or pose specifics that play to the user's actual features.
 */
export function tunedDescriptors(ctx: SubjectContext | null): string[] {
  // Default 9 — same buckets but a touch generic
  const defaults: string[] = [
    // A — Pose & Expression
    "thumbs up with a confident wink",
    "mid-laugh with eyes squeezed shut and one fist in the air",
    "surprised face with both hands on cheeks, mouth open in a small 'o'",
    // B — Caption Stickers
    "with a bold pop-art speech bubble that says 'HI!' in chunky hand-drawn letters",
    "with the word 'VIBES' arched above the head in bold sticker-style 3D text with a drop shadow",
    "with a thought bubble above the head that says 'mood' in rounded lowercase letters",
    // C — Style Twists
    "rendered in soft watercolor wash inside the same hard sticker outline",
    "rendered as a glossy 3D Pixar-style version with a rim-light highlight",
    "rendered in retro 90s anime cel-shaded style with classic anime sparkle eyes",
  ];

  if (!ctx) return defaults;

  const tuned = [...defaults];

  // Subject-aware tweaks
  if (ctx.subject === "pet-dog") {
    tuned[0] = "tail wagging with a happy panting smile, tongue out";
    tuned[1] = "head tilted to one side, looking adorably curious";
    tuned[2] = "playful zoomies pose, ears flapping back";
    tuned[3] = "with a speech bubble that says 'WOOF!'";
    tuned[5] = "with a thought bubble that says 'treats?'";
  } else if (ctx.subject === "pet-cat") {
    tuned[0] = "regal sitting pose with tail curled, half-closed eyes";
    tuned[1] = "playful pounce mid-air with paws extended";
    tuned[2] = "loafing pose with paws tucked under, content";
    tuned[3] = "with a speech bubble that says 'meow'";
    tuned[5] = "with a thought bubble that says 'no.'";
  } else if (ctx.subject === "child") {
    tuned[0] = "huge grin with both arms raised in celebration";
    tuned[3] = "with a speech bubble that says 'YAY!' in bouncy bubble letters";
    tuned[5] = "with a thought bubble that says 'so cool'";
  }

  // Glasses → swap in #6 to add a fun accessory shift
  if (ctx.glasses) {
    tuned[6] = "wearing oversized heart-shaped sunglasses, lips in a small smirk, otherwise same character";
  }

  // Beard / facial hair → variation that plays it up
  if (ctx.facialHair && /beard|mustache|goatee/i.test(ctx.facialHair)) {
    tuned[7] = "with an exaggeratedly styled handlebar mustache and a single rose between the teeth, glossy 3D Pixar render";
  }

  // Hat → preserve and exaggerate
  if (ctx.hat) {
    tuned[2] = `tipping the ${ctx.hat} with a charming smile and a slight bow`;
  }

  // Vibe-aware caption tweak
  if (ctx.vibe === "professional") {
    tuned[4] = "with the word 'BOSS' arched above the head in bold sticker-style 3D text with a drop shadow";
  } else if (ctx.vibe === "athletic") {
    tuned[4] = "with the word 'LET'S GO' arched above the head in bold sticker-style 3D text with a motion-line drop shadow";
  } else if (ctx.vibe === "playful") {
    tuned[4] = "with the word 'SLAY' arched above the head in glittery rainbow sticker-style 3D text";
  }

  return tuned;
}
