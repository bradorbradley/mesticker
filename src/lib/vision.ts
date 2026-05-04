/**
 * Vision-driven creative variation generation.
 *
 * Instead of a hardcoded template of "thumbs up wink / VIBES caption /
 * watercolor twist," we let GPT-4o-mini act as a world-class sticker
 * designer. It looks at the user's actual photo and composes nine
 * unique sticker concepts on the fly — different every time, specific
 * to what it sees, varied in genre.
 *
 * Cost: ~$0.002 per call (one-shot, ~500 in / ~400 out tokens).
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

const SYSTEM_PROMPT = `You are the lead designer for the world's most premium iMessage sticker pack studio. Your packs are collected, traded, screenshotted, and gifted. People obsess over them.

You're going to look at a photo of a real person and write nine wildly creative sticker prompts for a custom cartoon of them. The cartoon already exists — your prompts will direct a generative model to remix the SAME character into nine different sticker scenes.

NON-NEGOTIABLES:
1. ALL NINE MUST BE DIFFERENT FROM EACH OTHER — no two prompts repeat the same pose, scene, era, caption, prop, or vibe.
2. EACH MUST FEEL SPECIFIC TO THIS PERSON. Use what you see — their hair, beard, glasses, hat, outfit, age range, vibe, accessories. The pack should feel like it could only be theirs.
3. NEVER USE GENERIC CAPTIONS LIKE "HI!", "VIBES", "MOOD", "LOL". If a sticker has text, the words should sound like something this person would actually say. Original phrases. Insider energy.
4. RANGE IS REQUIRED. Across the nine, mix several of these flavors — don't lean on just one:
   - **Bold reaction stickers** (laughing crying, mind blown, in love, dead inside, screaming, kissing the air)
   - **Pop culture parody** (Renaissance painting, 90s sitcom poster, anime opening shot, video game boss screen, noir detective scene, vintage trading card)
   - **Situational scenes** (riding a tiny dragon, surfing a giant pizza slice, conducting an orchestra of cats, walking out of an explosion)
   - **Era mashups** (1920s flapper, disco 70s, cyberpunk 2077, medieval knight, Ancient Greek statue)
   - **Caption stickers** with ORIGINAL handwritten text reflecting this person's vibe
   - **Action poses** (mid-leap, mid-spin, throwing confetti, breakdancing)
   - **Style twists** (claymation, low-poly, pixel art, neon synthwave, oil painting, glitch art)
5. EACH PROMPT IS ONE PUNCHY SENTENCE describing what's happening and any text that appears. The model will translate the sentence into the sticker. Be visual, specific, sensory.

RETURN VALUE: JSON only. Schema:
{ "variations": [string, string, string, string, string, string, string, string, string] }

No commentary. No preamble. Just the JSON.`;

const FALLBACK_POOL = [
  "mid-laugh with eyes squeezed shut, confetti raining down",
  "rolling on the floor crying-laughing, tears flying",
  "mind-blown explosion behind the head, mouth wide open",
  "in love floating with cartoon hearts orbiting",
  "screaming with both hands on cheeks, Edvard Munch energy",
  "sleeping with a halo of cartoon Z's and a tiny pillow",
  "thumbs up with a confident wink and a sparkle on the tooth",
  "fist pump mid-jump with motion lines",
  "as a Renaissance oil painting in a gilded frame, dramatic chiaroscuro",
  "as a 90s sitcom intro freeze-frame with a smile and finger-gun",
  "as an anime opening title shot, wind-blown hair, sakura petals",
  "as a Mortal Kombat character select screen with name in arcade font",
  "as a noir detective in fedora and trench coat, cigarette smoke swirling",
  "as a vintage 1950s baseball trading card, faded edges and stats banner",
  "riding a tiny dragon through cotton candy clouds",
  "surfing on a giant slice of pepperoni pizza",
  "conducting an orchestra of tiny cats with a baton",
  "walking out of an explosion in slow motion, sunglasses on",
  "floating cross-legged in space surrounded by glowing planets",
  "breakdancing on a cardboard mat with a boombox beside them",
  "1920s flapper era with a sequined headband and martini glass",
  "1970s disco scene with sparkling jumpsuit under a mirrorball",
  "cyberpunk 2077 with neon hair, chrome implants, rainy alley behind",
  "medieval knight in shining armor wielding a glowing sword",
  "ancient Greek marble statue version, white stone, laurel wreath",
  "in claymation style with visible thumbprints and stop-motion charm",
  "in low-poly 3D with hard polygon faces and bright flat colors",
  "in 8-bit pixel art style with a glittering coin floating overhead",
  "in neon synthwave with magenta and cyan grid horizon behind",
  "in oil painting style with thick visible brushstrokes",
  "throwing handfuls of glitter into the air, glitter mid-fall",
  "with a comic-book style 'POW!' burst behind the head",
  "doing a peace sign with glittery rainbow energy lines",
  "winking and shooting finger guns with sparkles",
  "blowing a kiss with a cartoon heart floating away",
  "shrugging with a 'whatever' caption in handwritten cursive",
  "with the caption 'iconic' in bold drop-shadow lettering above",
  "with the caption 'main character' in vintage marquee letters",
  "with the caption 'log off' in retro pixel font",
  "in Spy vs Spy black ink style with a single accent color",
];

export interface DescriptorResult {
  descriptors: string[];
  source: "vision" | "fallback";
}

function pickRandom(pool: string[], n: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * Ask the vision model to compose nine unique sticker prompts for THIS
 * person's photo. Falls back to a randomized pool of curated descriptors
 * if the vision call fails or returns malformed output.
 */
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
      temperature: 1.1, // crank creativity
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Look closely at this person and write nine unique sticker prompts for them. Be specific to what you see. Each must be different. No generic captions.",
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
      // Pad with random fallback to guarantee 9 unique slots
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
