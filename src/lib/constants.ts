const STICKER_SUFFIX =
  " The subject should be isolated on a transparent background (no scene, no backdrop). Output a PNG with fully transparent alpha channel outside the subject. Clean, sharp silhouette edges — this will be kiss-cut into a physical sticker."

export const STYLE_PRESETS = {
  watercolor: {
    id: "watercolor",
    name: "Watercolor Romance",
    prompt:
      "Transform this photo into a soft watercolor portrait. Preserve the exact facial features, expression, and likeness of the person. Use romantic pastel tones, gentle brush strokes, and a dreamy fine art wedding style." +
      STICKER_SUFFIX,
    thumbnail: "/presets/watercolor.jpg",
  },
  ghibli: {
    id: "ghibli",
    name: "Studio Ghibli",
    prompt:
      "Transform this photo into a Studio Ghibli anime style portrait. Preserve the exact facial features and likeness of the person. Use soft watercolor textures, warm lighting, and the whimsical magical style of Hayao Miyazaki films." +
      STICKER_SUFFIX,
    thumbnail: "/presets/ghibli.jpg",
  },
  pixar: {
    id: "pixar",
    name: "Pixar 3D",
    prompt:
      "Transform this photo into a Pixar 3D animated style portrait. Preserve the exact facial features and likeness of the person. Use warm studio lighting, expressive features, and the charming aesthetic of Pixar films." +
      STICKER_SUFFIX,
    thumbnail: "/presets/pixar.jpg",
  },
  popart: {
    id: "popart",
    name: "Pop Art",
    prompt:
      "Transform this photo into a bold pop art style portrait. Preserve the exact facial features and likeness of the person. Use vibrant colors, halftone dots, and Andy Warhol inspired aesthetics." +
      STICKER_SUFFIX,
    thumbnail: "/presets/popart.jpg",
  },
  illustrated: {
    id: "illustrated",
    name: "Illustrated",
    prompt:
      "Transform this photo into a charming illustrated portrait. Preserve the exact facial features and likeness of the person. Use a storybook illustration style with warm colors, clean lines, and whimsical details." +
      STICKER_SUFFIX,
    thumbnail: "/presets/illustrated.jpg",
  },
  vintage: {
    id: "vintage",
    name: "Vintage Poster",
    prompt:
      "Transform this photo into a vintage travel poster style portrait. Preserve the exact facial features and likeness of the person. Use art deco influences, muted retro colors, and bold graphic shapes." +
      STICKER_SUFFIX,
    thumbnail: "/presets/vintage.jpg",
  },
} as const

export type StylePresetKey = keyof typeof STYLE_PRESETS

export const PRICING = {
  stickerPriceCents: 999, // $9.99 - Kiss-Cut Sticker Sheet
  shippingPriceCents: 399, // $3.99 - US standard
  totalPriceCents: 1398, // $13.98 total
} as const

export const APP_CONFIG = {
  name: "MeSticker",
  description: "Turn your photos into custom stickers",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
} as const
