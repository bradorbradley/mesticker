export const STYLE_PRESETS = {
  watercolor: {
    id: "watercolor",
    name: "Watercolor Romance",
    prompt:
      "Transform this photo into a soft watercolor portrait. Preserve the exact facial features, expression, and likeness of the person. Use romantic pastel tones, gentle brush strokes, and a dreamy fine art wedding style. The result should be sticker-ready with clean edges.",
    thumbnail: "/presets/watercolor.jpg",
  },
  ghibli: {
    id: "ghibli",
    name: "Studio Ghibli",
    prompt:
      "Transform this photo into a Studio Ghibli anime style portrait. Preserve the exact facial features and likeness of the person. Use soft watercolor textures, warm lighting, and the whimsical magical style of Hayao Miyazaki films. The result should be sticker-ready with clean edges.",
    thumbnail: "/presets/ghibli.jpg",
  },
  pixar: {
    id: "pixar",
    name: "Pixar 3D",
    prompt:
      "Transform this photo into a Pixar 3D animated style portrait. Preserve the exact facial features and likeness of the person. Use warm studio lighting, expressive features, and the charming aesthetic of Pixar films. The result should be sticker-ready with clean edges.",
    thumbnail: "/presets/pixar.jpg",
  },
  popart: {
    id: "popart",
    name: "Pop Art",
    prompt:
      "Transform this photo into a bold pop art style portrait. Preserve the exact facial features and likeness of the person. Use vibrant colors, halftone dots, and Andy Warhol inspired aesthetics. The result should be sticker-ready with clean edges.",
    thumbnail: "/presets/popart.jpg",
  },
  illustrated: {
    id: "illustrated",
    name: "Illustrated",
    prompt:
      "Transform this photo into a charming illustrated portrait. Preserve the exact facial features and likeness of the person. Use a storybook illustration style with warm colors, clean lines, and whimsical details. The result should be sticker-ready with clean edges.",
    thumbnail: "/presets/illustrated.jpg",
  },
  vintage: {
    id: "vintage",
    name: "Vintage Poster",
    prompt:
      "Transform this photo into a vintage travel poster style portrait. Preserve the exact facial features and likeness of the person. Use art deco influences, muted retro colors, and bold graphic shapes. The result should be sticker-ready with clean edges.",
    thumbnail: "/presets/vintage.jpg",
  },
} as const

export type StylePresetKey = keyof typeof STYLE_PRESETS

export const PRICING = {
  stickerPriceCents: 999, // $9.99
  shippingPriceCents: 399, // $3.99
  totalPriceCents: 1398, // $13.98
} as const

export const APP_CONFIG = {
  name: "MeSticker",
  description: "Turn your photos into custom stickers",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
} as const
