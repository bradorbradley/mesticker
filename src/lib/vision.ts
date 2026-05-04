/**
 * Vision-driven creative variation generation.
 *
 * GPT-4o-mini acts as a world-class sticker designer. It looks at the
 * user's actual photo and composes nine unique sticker concepts on the
 * fly — different every time, specific to what it sees, varied in genre.
 *
 * NO TEXT, NO CAPTIONS, NO SPEECH BUBBLES. Pure character-based variations.
 *
 * Cost: ~$0.002 per call (~500 in / ~400 out tokens).
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

const SYSTEM_PROMPT = `You are the lead designer for the world's most premium iMessage sticker pack studio. Your packs are collected, traded, screenshotted, and gifted. People obsess over them.

You're going to look at a photo of a real person and write nine wildly creative sticker prompts for a custom cartoon of them. The cartoon already exists — your prompts will direct a generative model to remix the SAME character into nine different sticker scenes.

NON-NEGOTIABLES:
1. NO TEXT. NO CAPTIONS. NO SPEECH BUBBLES. NO WORDS ANYWHERE IN THE STICKER. The sticker is the character only — pose, scene, expression, props, setting. Words feel cringe without context. Strip them.
2. ALL NINE MUST BE DIFFERENT FROM EACH OTHER — no two prompts repeat the same pose, scene, era, prop, or vibe.
3. EACH MUST FEEL SPECIFIC TO THIS PERSON. Use what you see — their hair, beard, glasses, hat, outfit, age range, vibe, accessories. The pack should feel like it could only be theirs.
4. RANGE IS REQUIRED. Across the nine, mix several of these flavors — don't lean on just one:
   - **Bold reaction stickers** (laughing crying, mind blown, in love, dead inside, screaming, kissing the air, eye-roll)
   - **Pop culture parody** (Renaissance painting, 90s sitcom freeze-frame, anime opening shot, video game boss screen, noir detective scene, vintage trading card)
   - **Situational scenes** (riding a tiny dragon, surfing a giant pizza slice, conducting an orchestra of cats, walking out of an explosion, floating in space)
   - **Era mashups** (1920s flapper, disco 70s, cyberpunk 2077, medieval knight, Ancient Greek statue)
   - **Action poses** (mid-leap, mid-spin, throwing confetti, breakdancing, fist-pumping)
   - **Style twists** (claymation, low-poly, pixel art, neon synthwave, oil painting, glitch art, watercolor)
5. EACH PROMPT IS ONE PUNCHY SENTENCE describing what's happening visually. The model translates the sentence into the sticker. Be visual, specific, sensory. Describe a scene, not a feeling.

RETURN VALUE: JSON only. Schema:
{ "variations": [string, string, string, string, string, string, string, string, string] }

No commentary. No preamble. Just the JSON.`;

const FALLBACK_POOL = [
  // Bold reactions — no text
  "mid-laugh with eyes squeezed shut, head thrown back, confetti raining down",
  "rolling on the floor crying-laughing, tears spraying everywhere",
  "mind-blown explosion behind the head, mouth wide open, eyes huge",
  "in love floating with cartoon hearts orbiting around the head",
  "screaming with both hands on cheeks, Edvard Munch energy",
  "sleeping curled up with a halo of cartoon Z's and a tiny pillow",
  "thumbs up with a confident wink and a sparkle on the tooth",
  "fist pump mid-jump with motion lines streaking behind",
  "rolling eyes dramatically, head tilted back",

  // Pop culture parody — no text
  "as a Renaissance oil painting in a gilded frame with dramatic chiaroscuro lighting",
  "as a 90s sitcom freeze-frame, finger-gun pose, soft-focus glow",
  "as an anime opening title shot with wind-blown hair and falling sakura petals",
  "as a Mortal Kombat character select pose, fists raised",
  "as a noir detective in a fedora and trench coat with cigarette smoke swirling",
  "as a vintage 1950s baseball trading card with a faded sepia tint",

  // Situational scenes — no text
  "riding a tiny pastel dragon through cotton candy clouds",
  "surfing on a giant slice of pepperoni pizza across an ocean of soda",
  "conducting an orchestra of tiny cats with a baton in hand",
  "walking out of a fiery explosion in slow motion, sunglasses on",
  "floating cross-legged in space surrounded by glowing planets",
  "breakdancing on a cardboard mat with a vintage boombox beside them",
  "skydiving with arms spread, cheeks puffed from the wind",
  "sitting on a throne of cookies, holding a milk goblet like a king",

  // Era mashups — no text
  "as a 1920s flapper with a sequined headband and a martini glass tilted",
  "as a 1970s disco dancer in a sparkling jumpsuit under a mirrorball",
  "as a cyberpunk hacker with neon hair and chrome implants in a rainy alley",
  "as a medieval knight in shining armor wielding a glowing sword",
  "as an ancient Greek marble statue with a laurel wreath and chiseled stoic expression",

  // Style twists — no text
  "rendered in claymation style with visible thumbprints and stop-motion charm",
  "rendered in low-poly 3D with hard polygon faces and bright flat colors",
  "rendered in 8-bit pixel art with chunky pixels and retro arcade vibe",
  "rendered in neon synthwave with magenta and cyan grid horizon behind",
  "rendered in oil painting style with thick visible brushstrokes",
  "rendered in glitch art style with chromatic aberration and scan lines",
  "rendered in watercolor wash with soft pastel bleeds inside hard outlines",

  // Action poses — no text
  "throwing handfuls of glitter into the air with a wide grin",
  "doing a high-kick mid-air with comic-book impact lines",
  "blowing a kiss with a cartoon heart floating away",
  "shrugging with palms up and an eye-roll",
  "winking and shooting finger-guns with sparkles",
  "in a power pose with hands on hips, cape flowing behind",
];

export interface DescriptorResult {
  descriptors: string[];
  source: "vision" | "fallback";
}

function pickRandom(pool: string[], n: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function generateVariationDescriptors(
  photoBase64: string
): Promise<DescriptorResult> {
  if (!photoBase64) {
    return { descriptors: pickRandom(FALLBACK_POOL, 9), source: "fallback" };
  }

  try {
    const dataUrl = photoBase64.startsWith("data:")
      ? photoBase64
      : `data:image/png;base64,${photoBase64}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      temperature: 1.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Look closely at this person and write nine unique sticker prompts for them. Be specific to what you see. Each must be different. Pure character — no text or captions anywhere.",
            },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return { descriptors: pickRandom(FALLBACK_POOL, 9), source: "fallback" };
    }

    const parsed = JSON.parse(text) as { variations?: unknown };
    const arr = Array.isArray(parsed.variations) ? parsed.variations : null;
    if (!arr || arr.length < 9) {
      return { descriptors: pickRandom(FALLBACK_POOL, 9), source: "fallback" };
    }

    const cleaned = arr
      .filter((s): s is string => typeof s === "string" && s.length > 8)
      .slice(0, 9);

    if (cleaned.length < 9) {
      const needed = 9 - cleaned.length;
      const padding = pickRandom(
        FALLBACK_POOL.filter((p) => !cleaned.includes(p)),
        needed
      );
      return { descriptors: [...cleaned, ...padding], source: "vision" };
    }

    return { descriptors: cleaned, source: "vision" };
  } catch (err) {
    console.error("[vision] generateVariationDescriptors failed:", err);
    return { descriptors: pickRandom(FALLBACK_POOL, 9), source: "fallback" };
  }
}
