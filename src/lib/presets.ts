import { StylePreset } from "@/types";

/**
 * Universal sticker-aesthetic suffix appended to every prompt.
 * Forces hard outlines, flat colors, and clean kiss-cut edges so the
 * output looks like a die-cut vinyl sticker, not a soft AR filter.
 */
const STICKER_SUFFIX =
  " Thick bold black outline. Flat saturated colors. Crisp sharp edges. Isolated subject on fully transparent background. Die-cut sticker style — like a vinyl decal you can peel and stick. No background, no shadows, no frames.";

export const stylePresets: StylePreset[] = [
  {
    id: "pixar",
    name: "Pixar",
    description: "3D animated movie character",
    previewImage: "/presets/3d-animated.jpg",
    prompt:
      "Transform this photo into a Pixar-style 3D animated character. Smooth stylized skin, large expressive eyes, warm cinematic lighting baked into the character itself. Toy Story / Inside Out / Coco design language. Keep the person's exact body proportions and build. Keep them fully recognizable." +
      STICKER_SUFFIX,
  },
  {
    id: "spongebob",
    name: "SpongeBob",
    description: "Bikini Bottom cartoon style",
    previewImage: "/presets/spongebob.webp",
    prompt:
      "Transform this photo into a character that belongs in the SpongeBob SquarePants universe. Bright saturated Nickelodeon palette, exaggerated goofy expression, simple shapes, flat shading. Capture the wacky Bikini Bottom energy. Keep the person recognizable." +
      STICKER_SUFFIX,
  },
  {
    id: "simpsons",
    name: "Simpsons",
    description: "Yellow skin, Springfield style",
    previewImage: "/presets/simpsons.jpg",
    prompt:
      "Transform this photo into a character from The Simpsons. Yellow skin, overbite, bulging round eyes, classic Springfield cartoon style. Simplified features. Keep the person recognizable — capture their hairstyle, clothing, and distinguishing features." +
      STICKER_SUFFIX,
  },
  {
    id: "rick-and-morty",
    name: "Rick & Morty",
    description: "Interdimensional cartoon style",
    previewImage: "/presets/rick-morty.webp",
    prompt:
      "Transform this photo into a character from Rick and Morty. Wobbly hand-drawn outlines, slightly asymmetric features, flat cel-shaded colors, sci-fi cartoon energy. Exaggerated head proportions, simple oval eyes with visible pupils. Keep the person recognizable." +
      STICKER_SUFFIX,
  },
  {
    id: "family-guy",
    name: "Family Guy",
    description: "Quahog cartoon style",
    previewImage: "/presets/family-guy.webp",
    prompt:
      "Transform this photo into a character from Family Guy. Round/oval head shape, small simple white-circle eyes, prominent chin, flat colors. Seth MacFarlane animation style. Keep recognizable features like hairstyle and clothing." +
      STICKER_SUFFIX,
  },
  {
    id: "chibi",
    name: "Chibi",
    description: "Adorable anime chibi style",
    previewImage: "/presets/chibi.jpg",
    prompt:
      "Transform this photo into an adorable chibi anime character. Enormous head (2-3x body size), tiny stubby body, huge sparkly eyes, simplified kawaii features, vibrant anime coloring. Match their hairstyle, hair color, and clothing." +
      STICKER_SUFFIX,
  },
  {
    id: "anime",
    name: "Anime",
    description: "Classic anime / manga look",
    previewImage: "",
    prompt:
      "Transform this photo into a detailed anime character in modern Japanese animation style. Sharp angular features, dramatic cel-shading, vibrant hair and eye colors. Attack on Titan / Jujutsu Kaisen / MHA design language. Keep the person's face recognizable." +
      STICKER_SUFFIX,
  },
  {
    id: "comic-book",
    name: "Comic Book",
    description: "Marvel / DC superhero art",
    previewImage: "",
    prompt:
      "Transform this photo into a Marvel/DC comic book superhero illustration. Bold ink outlines, Ben-Day dots, dramatic high-contrast shadows, dynamic perspective, heroic proportions. Jim Lee / Todd McFarlane vibe. Keep the person recognizable." +
      STICKER_SUFFIX,
  },
  {
    id: "watercolor",
    name: "Watercolor",
    description: "Soft painted portrait",
    previewImage: "",
    prompt:
      "Transform this photo into a watercolor portrait painting with a hard sticker outline. Soft flowing washes of color INSIDE the outline, visible brushstrokes, gentle blending. Painterly but die-cut. Keep the person recognizable." +
      STICKER_SUFFIX,
  },
  {
    id: "random",
    name: "Random",
    description: "Surprise me!",
    previewImage: "/presets/random.svg",
    prompt: "__RANDOM__",
  },
  {
    id: "custom",
    name: "Your Style",
    description: "Describe any style you want",
    previewImage: "/presets/random.svg",
    prompt: "__CUSTOM__",
  },
];

export function getDisplayPresets(): StylePreset[] {
  return stylePresets;
}

export function resolvePresetPrompt(presetId: string): { prompt: string; resolvedId: string } {
  if (presetId === "random") {
    const realPresets = stylePresets.filter((p) => p.id !== "random" && p.id !== "custom");
    const pick = realPresets[Math.floor(Math.random() * realPresets.length)];
    return { prompt: pick.prompt, resolvedId: pick.id };
  }
  const preset = stylePresets.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Unknown preset: ${presetId}`);
  return { prompt: preset.prompt, resolvedId: preset.id };
}

/**
 * Build a variation prompt. The variations API feeds the FIRST generated
 * cartoon back in as the input image, so the character identity is locked.
 */
export function buildVariationPrompt(variation: string): string {
  return `Keep this EXACT same character — identical face, hair, outfit, color palette, and art style. Only change: ${variation}.${STICKER_SUFFIX}`;
}

/**
 * 9 variation descriptors organized in three buckets:
 *
 *   Bucket A — Pose & Expression (3): the iMessage-pack staples
 *   Bucket B — Caption Stickers (3): same character + word-art / speech bubble
 *   Bucket C — Style Twists (3): same character, slight medium shift
 *
 * Designed to feel like a curated set, not a random pose dump.
 */
export const VARIATION_DESCRIPTORS = [
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
