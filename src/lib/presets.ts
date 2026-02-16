import { StylePreset } from "@/types";

export const stylePresets: StylePreset[] = [
  {
    id: "pixar",
    name: "Pixar",
    description: "3D animated movie character",
    previewImage: "/presets/3d-animated.jpg",
    prompt:
      "Transform this photo into a Pixar-style 3D animated character. Smooth stylized skin, large expressive eyes, slightly exaggerated proportions, warm cinematic lighting. Think Toy Story / Inside Out / Coco character design. Keep the person fully recognizable but as a polished CG animated character. Sticker-ready with a clean outline edge and transparent background.",
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
    id: "scooby-doo",
    name: "Scooby-Doo",
    description: "Classic Hanna-Barbera style",
    previewImage: "/presets/random.svg",
    prompt:
      "Transform this photo into a character from Scooby-Doo in classic Hanna-Barbera animation style. Thick clean outlines, flat cel-shaded colors, slightly retro 70s cartoon aesthetic. Think Mystery Inc. character design — simple shapes, expressive eyes, clean color blocks. Keep the person recognizable but fully in the Scooby-Doo art style. Sticker-ready with a clean outline edge and transparent background.",
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
    id: "random",
    name: "Random",
    description: "Surprise me with a random style!",
    previewImage: "/presets/random.svg",
    prompt: "__RANDOM__",
  },
];

/** Get the actual prompt for a preset, resolving "random" to a real style */
export function resolvePresetPrompt(presetId: string): { prompt: string; resolvedId: string } {
  if (presetId === "random") {
    const realPresets = stylePresets.filter((p) => p.id !== "random");
    const pick = realPresets[Math.floor(Math.random() * realPresets.length)];
    return { prompt: pick.prompt, resolvedId: pick.id };
  }
  const preset = stylePresets.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Unknown preset: ${presetId}`);
  return { prompt: preset.prompt, resolvedId: preset.id };
}
