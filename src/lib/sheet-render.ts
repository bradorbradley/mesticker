/**
 * Server-side sticker sheets (sharp), matching the booth's canvas output:
 * trim each sticker to its own shape, add a white die-cut border with a faint
 * grey hairline (so the PixCut's auto-contour sees an edge), then place the
 * stickers into a layout. Used by the MCP tools.
 */

import sharp from "sharp";
import { checkLayout, LAYOUTS, SHEET_H, SHEET_W, SLOT_SHRINK, type LayoutId, type Slot } from "@/lib/sheet-layouts";

/** Read a data: URL or fetch an http(s) URL into a buffer. */
export async function loadImageBuffer(src: string): Promise<Buffer> {
  const m = src.match(/^data:[^;]+;base64,(.*)$/);
  if (m) return Buffer.from(m[1], "base64");
  if (!/^https?:\/\//.test(src)) throw new Error(`Not an image URL: ${src.slice(0, 60)}`);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Couldn't fetch ${src} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export const toDataUrl = (buf: Buffer, mime = "image/png") => `data:${mime};base64,${buf.toString("base64")}`;

/** Grow the alpha mask outward by ~radius px (blur + threshold = round corners). */
async function grow(alpha: Buffer, width: number, height: number, radius: number) {
  // Separate pipelines on purpose: sharp keeps one blur per pipeline and
  // applies threshold in its own fixed order, so chaining these would skip
  // the big blur and the border would barely grow.
  const raw = { raw: { width, height, channels: 1 as const } };
  const spread = await sharp(alpha, raw).blur(Math.max(0.3, radius / 1.76)).extractChannel(0).raw().toBuffer();
  const hard = await sharp(spread, raw).threshold(10).extractChannel(0).raw().toBuffer();
  return sharp(hard, raw).blur(0.8).extractChannel(0).raw().toBuffer(); // soften the stair-steps
}

/** One solid-colour layer shaped like the mask. */
function colourLayer(mask: Buffer, width: number, height: number, [r, g, b]: [number, number, number]) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = mask[i];
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

export type BorderWeight = "thin" | "normal" | "thick";
const BORDER_FRACTION: Record<BorderWeight, number> = { thin: 0.022, normal: 0.035, thick: 0.055 };

/** Trim to the character, then add the white die-cut border. Returns a PNG. */
export async function borderSticker(input: Buffer, weight: BorderWeight = "normal"): Promise<Buffer> {
  let trimmed = input;
  try {
    trimmed = await sharp(input).ensureAlpha().trim({ threshold: 10 }).png().toBuffer();
  } catch {
    /* nothing to trim */
  }
  const meta = await sharp(trimmed).metadata();
  const radius = Math.round(Math.max(meta.width ?? 512, meta.height ?? 512) * BORDER_FRACTION[weight]);
  const pad = radius + 10;
  const padded = await sharp(trimmed)
    .ensureAlpha()
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const { data: alpha, info } = await sharp(padded).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const [white, grey] = await Promise.all([grow(alpha, info.width, info.height, radius), grow(alpha, info.width, info.height, radius + 3)]);
  const [whiteLayer, greyLayer] = await Promise.all([
    colourLayer(white, info.width, info.height, [255, 255, 255]),
    colourLayer(grey, info.width, info.height, [212, 208, 200]),
  ]);
  return sharp(greyLayer)
    .composite([{ input: whiteLayer }, { input: padded }])
    .png()
    .toBuffer();
}

export interface SheetResult {
  png: Buffer;
  preview: Buffer; // small JPEG for the agent to look at
  problems: string[];
}

/**
 * Place bordered stickers into slots. `stickers[i]` fills slot i; if there are
 * fewer stickers than slots they repeat in order.
 */
export async function renderSheet(stickers: Buffer[], layout: LayoutId | Slot[]): Promise<SheetResult> {
  if (!stickers.length) throw new Error("No stickers to place");
  const slots = typeof layout === "string" ? LAYOUTS[layout] : layout;
  const metas = await Promise.all(stickers.map((s) => sharp(s).metadata()));
  const aspects = slots.map((_, i) => {
    const m = metas[i % metas.length];
    return (m.width ?? 1) / (m.height ?? 1);
  });
  const problems = checkLayout(slots, aspects);

  const overlays = await Promise.all(
    slots.map(async ([x, y, w, h, rot], i) => {
      const src = stickers[i % stickers.length];
      const aspect = aspects[i];
      const fw = Math.round((aspect >= w / h ? w : h * aspect) * SLOT_SHRINK);
      const fh = Math.round((aspect >= w / h ? w / aspect : h) * SLOT_SHRINK);
      const placed = await sharp(src)
        .resize(fw, fh, { fit: "fill" })
        .rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer({ resolveWithObject: true });
      const left = Math.round(x + w / 2 - placed.info.width / 2);
      const top = Math.round(y + h / 2 - placed.info.height / 2);
      return { input: placed.data, left: Math.max(0, left), top: Math.max(0, top) };
    })
  );

  const png = await sharp({ create: { width: SHEET_W, height: SHEET_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(overlays)
    .png()
    .toBuffer();
  const preview = await sharp(png).flatten({ background: "#ffffff" }).resize({ height: 900 }).jpeg({ quality: 80 }).toBuffer();
  return { png, preview, problems };
}
