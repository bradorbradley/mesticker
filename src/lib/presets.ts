import { StylePreset } from "@/types";

export const stylePresets: StylePreset[] = [
  {
    id: "cartoon-pop",
    name: "Cartoon Pop",
    description: "Bold outlines, bright colors, classic cartoon vibes",
    previewImage: "/presets/cartoon-pop.png",
    prompt:
      "Transform this photo into a bold cartoon-style sticker illustration. Use thick black outlines, vibrant saturated colors, and simplified features. Make it look like a fun cartoon character with exaggerated proportions. The style should be similar to a vinyl sticker you'd put on a laptop. Keep the person's likeness recognizable. White background.",
  },
  {
    id: "anime",
    name: "Anime",
    description: "Japanese anime-inspired with big expressive eyes",
    previewImage: "/presets/anime.png",
    prompt:
      "Transform this photo into a Japanese anime-style sticker illustration. Use the characteristic anime art style with large expressive eyes, smooth shading, and clean lines. Keep hair and clothing details stylized but recognizable. The person should look like an anime character while maintaining their likeness. White background.",
  },
  {
    id: "pixel-art",
    name: "Pixel Art",
    description: "Retro 16-bit pixel art style",
    previewImage: "/presets/pixel-art.png",
    prompt:
      "Transform this photo into a retro pixel art style sticker illustration, like a 16-bit video game character portrait. Use a limited color palette with visible pixels, but keep the person recognizable. Make it look like a classic RPG character portrait. White background.",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    description: "Soft watercolor painting with gentle washes",
    previewImage: "/presets/watercolor.png",
    prompt:
      "Transform this photo into a beautiful watercolor portrait sticker illustration. Use soft, flowing watercolor washes with visible brush strokes and gentle color bleeding. Keep the person's features recognizable but with an artistic, painterly quality. Use a harmonious color palette. White background.",
  },
  {
    id: "chibi",
    name: "Chibi",
    description: "Adorable chibi style with a big head and tiny body",
    previewImage: "/presets/chibi.png",
    prompt:
      "Transform this photo into an adorable chibi-style sticker illustration. Give the character a very large head (about 1:1 ratio with the body), big sparkly eyes, and a tiny cute body. Use bright cheerful colors and clean outlines. Keep the person recognizable through their hair, accessories, and outfit. White background.",
  },
  {
    id: "comic-book",
    name: "Comic Book",
    description: "Classic American comic book halftone style",
    previewImage: "/presets/comic-book.png",
    prompt:
      "Transform this photo into a classic American comic book style sticker illustration. Use bold ink lines, dramatic shading with halftone dot patterns, and a limited but punchy color palette. The person should look like a superhero comic character. White background.",
  },
];
