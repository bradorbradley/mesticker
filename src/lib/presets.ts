import { StylePreset } from "@/types";

export const stylePresets: StylePreset[] = [
  {
    id: "pixar",
    name: "Pixar",
    description: "3D animated movie character",
    previewImage: "/presets/3d-animated.jpg",
    prompt:
      "Transform this photo into a Pixar-style 3D animated character. Smooth stylized skin, large expressive eyes, warm cinematic lighting. Think Toy Story / Inside Out / Coco character design. Keep the person's exact body proportions and build — do NOT make them wider, heavier, or rounder. The character should match the person's real physique. Keep them fully recognizable as a polished CG animated character. Sticker-ready with a clean outline edge and transparent background.",
  },
  {
    id: "spongebob",
    name: "SpongeBob",
    description: "Bikini Bottom cartoon style",
    previewImage: "/presets/spongebob.webp",
    prompt:
      "Transform this photo into a character that belongs in the SpongeBob SquarePants universe. Bold outlines, bright saturated colors, exaggerated goofy expressions, simple shapes, flat shading. Capture the wacky Bikini Bottom energy and Nickelodeon cartoon style. Keep the person recognizable but fully in SpongeBob art style. Sticker-ready with a clean outline edge and transparent background.",
  },
  {
    id: "simpsons",
    name: "Simpsons",
    description: "Yellow skin, Springfield style",
    previewImage: "/presets/simpsons.jpg",
    prompt:
      "Transform this photo into a character from The Simpsons. Yellow skin, overbite, bulging eyes, classic Springfield cartoon style. Bold black outlines, flat colors, simplified features. Keep the person recognizable in Simpsons form — capture their hairstyle, clothing, and distinguishing features. Sticker-ready with a clean outline edge and transparent background.",
  },
  {
    id: "rick-and-morty",
    name: "Rick & Morty",
    description: "Interdimensional cartoon style",
    previewImage: "/presets/rick-morty.webp",
    prompt:
      "Transform this photo into a character from Rick and Morty. Wobbly outlines, slightly asymmetric features, flat cel-shaded colors, sci-fi cartoon energy. Exaggerated head proportions, simple dot eyes or oval eyes with visible pupils. Keep the person recognizable but fully in the Rick and Morty art style. Sticker-ready with a clean outline edge and transparent background.",
  },
  {
    id: "family-guy",
    name: "Family Guy",
    description: "Quahog cartoon style",
    previewImage: "/presets/family-guy.webp",
    prompt:
      "Transform this photo into a character from Family Guy. Round/oval head shape, small simple eyes, prominent chin, flat colors, clean cartoon outlines. Capture the Seth MacFarlane animation style. Keep recognizable features like hairstyle and clothing but fully in Family Guy art style. Sticker-ready with a clean outline edge and transparent background.",
  },
  {
    id: "chibi",
    name: "Chibi",
    description: "Adorable anime chibi style",
    previewImage: "/presets/chibi.jpg",
    prompt:
      "Transform this photo into an adorable chibi anime character. Enormous head (2-3x body size), tiny stubby body, huge sparkly eyes, simplified cute features, vibrant anime coloring. Make it irresistibly cute and kawaii while keeping the person recognizable — match their hairstyle, hair color, and clothing. Sticker-ready with a clean outline edge and transparent background.",
  },
  {
    id: "anime",
    name: "Anime",
    description: "Classic anime / manga look",
    previewImage: "",
    prompt:
      "Transform this photo into a detailed anime character in modern Japanese animation style. Sharp angular features, dramatic shading, vibrant hair and eye colors, dynamic pose energy. Think Attack on Titan / Jujutsu Kaisen / My Hero Academia character design. Keep the person's face recognizable but fully rendered in anime art style. Sticker-ready with a clean outline edge and transparent background.",
  },
  {
    id: "comic-book",
    name: "Comic Book",
    description: "Marvel / DC superhero art",
    previewImage: "",
    prompt:
      "Transform this photo into a Marvel/DC comic book superhero illustration. Bold ink outlines, Ben-Day dots, dramatic shadows, dynamic perspective, heroic proportions. Classic American comic book art style — think Jim Lee or Todd McFarlane. Keep the person recognizable as a comic character version of themselves. Sticker-ready with a clean outline edge and transparent background.",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    description: "Soft painted portrait",
    previewImage: "",
    prompt:
      "Transform this photo into a beautiful watercolor portrait painting. Soft flowing washes of color, visible brushstrokes, gentle blending, artistic splatter effects at the edges. Ethereal and dreamy quality with warm, luminous colors. Keep the person recognizable with their key features captured in painterly strokes. Sticker-ready with a clean outline edge and transparent background.",
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

/** Get only the selectable presets (exclude custom placeholder) */
export function getDisplayPresets(): StylePreset[] {
  return stylePresets;
}

/** Get the actual prompt for a preset, resolving "random" to a real style */
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

/** Build a variation prompt from a base style */
export function buildVariationPrompt(stylePrompt: string, variation: string): string {
  return `${stylePrompt} The character is ${variation}. Keep the same person's face, hair, and identity recognizable.`;
}

/** Predefined variation descriptors */
export const VARIATION_DESCRIPTORS = [
  "wearing a casual hoodie, waving hello, big smile",
  "wearing formal attire, thumbs up, confident smirk",
  "in summer beach outfit, peace sign, laughing",
  "in winter coat, jumping with arms up, surprised expression",
  "in pajamas, sleeping pose, peaceful look",
  "wearing party clothes, side profile, silly tongue out",
];
