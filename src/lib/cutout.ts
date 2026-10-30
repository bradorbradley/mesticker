/**
 * White-background removal for models that can't output transparency
 * (Gemini / FLUX). Flood-fills near-white pixels connected to the image
 * border and makes them transparent, with a 1px feathered edge.
 *
 * Works because the booth prompts ask non-OpenAI models for a plain pure
 * white background. remove.bg is still preferred when REMOVEBG_API_KEY is set.
 */

import sharp from "sharp";

const WHITE_MIN = 235; // every channel above this…
const WHITE_SPREAD = 18; // …and nearly grey (max - min channel)

export async function cutoutWhiteBackground(dataUrl: string): Promise<string> {
  const input = Buffer.from(dataUrl.replace(/^data:image\/[\w+.-]+;base64,/, ""), "base64");
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);

  const isWhite = (i: number) => {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const mn = Math.min(r, g, b);
    return mn > WHITE_MIN && Math.max(r, g, b) - mn < WHITE_SPREAD;
  };

  const bg = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const seed = (i: number) => {
    if (!bg[i] && isWhite(i)) {
      bg[i] = 1;
      stack[sp++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (sp > 0) {
    const i = stack[--sp];
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < w * (h - 1)) seed(i + w);
  }

  // Nothing removed → model ignored the white-background instruction.
  let removed = 0;
  for (let i = 0; i < bg.length; i++) removed += bg[i];
  if (removed < w * h * 0.02) return dataUrl;

  for (let i = 0; i < w * h; i++) {
    if (bg[i]) {
      px[i * 4 + 3] = 0;
      continue;
    }
    // Feather: subject pixels touching background get half alpha.
    const x = i % w;
    const edge =
      (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < w * (h - 1) && bg[i + w]);
    if (edge) px[i * 4 + 3] = Math.min(px[i * 4 + 3], 160);
  }

  const out = await sharp(Buffer.from(px.buffer, px.byteOffset, px.length), {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${out.toString("base64")}`;
}
