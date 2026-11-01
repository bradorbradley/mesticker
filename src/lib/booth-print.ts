/**
 * Print files for the Liene PixCut S1 (4×7" sheets, 3.9×6.7" printable).
 *
 *   addStickerBorder → the sticker with a thick white die-cut border plus a
 *                      faint grey hairline, so the printer's auto-contour has
 *                      a visible edge to cut along on white paper.
 *   composePrintSheet → portrait 1170×2010 px (300 DPI) collage layouts with
 *                      mixed sizes and tilts (see LAYOUTS).
 *
 * Runs in the browser via Canvas, like compose-sheet-client.ts.
 */

import { LAYOUTS, SHEET_H, SHEET_W, SLOT_SHRINK as SHRINK, type LayoutId } from "./sheet-layouts";

export { LAYOUTS, type LayoutId };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function silhouette(img: HTMLImageElement | HTMLCanvasElement, color: string) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Stamp a silhouette in rings out to `radius` to grow it outward. */
function stampRing(ctx: CanvasRenderingContext2D, sil: HTMLCanvasElement, pad: number, radius: number) {
  for (let r = radius / 3; r <= radius + 0.01; r += radius / 3) {
    for (let a = 0; a < 360; a += 10) {
      const t = (a * Math.PI) / 180;
      ctx.drawImage(sil, pad + Math.cos(t) * r, pad + Math.sin(t) * r);
    }
  }
}

/**
 * Crop away the empty transparent margin around the character, so each
 * sticker prints at its real size and shape (tall, wide, round) instead of
 * every one being the same padded square.
 */
function trimTransparent(img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return img; // fully transparent? leave it
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (w > width * 0.97 && h > height * 0.97) return img; // opaque photo, nothing to trim
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(c, x0, y0, w, h, 0, 0, w, h);
  return out;
}

export async function addStickerBorder(src: string, borderFraction = 0.035): Promise<string> {
  const loaded = await loadImage(src);
  const img = trimTransparent(loaded);
  const radius = Math.round(Math.max(img.width, img.height) * borderFraction);
  const hairline = 3;
  const pad = radius + hairline + 4;
  const c = document.createElement("canvas");
  c.width = img.width + pad * 2;
  c.height = img.height + pad * 2;
  const ctx = c.getContext("2d")!;
  stampRing(ctx, silhouette(img, "#d4d0c8"), pad, radius + hairline);
  stampRing(ctx, silhouette(img, "#ffffff"), pad, radius);
  ctx.drawImage(img, pad, pad);
  return c.toDataURL("image/png");
}

/**
 * Compose one print sheet. `srcs[i]` fills slot i (bordered stickers);
 * null draws a soft placeholder (used by the on-screen preview while a
 * pose is still being made); missing entries reuse srcs[0].
 */
export async function composePrintSheet(srcs: (string | null)[], layout: LayoutId): Promise<string> {
  const slots = LAYOUTS[layout];
  const uniq = Array.from(new Set(srcs.filter((s): s is string => !!s)));
  const loaded = new Map(await Promise.all(uniq.map(async (s) => [s, await loadImage(s)] as const)));
  const c = document.createElement("canvas");
  c.width = SHEET_W;
  c.height = SHEET_H;
  const ctx = c.getContext("2d")!;

  slots.forEach(([x, y, w, h, rot], i) => {
    const src = i < srcs.length ? srcs[i] : srcs[0];
    const img = src ? loaded.get(src) : null;
    const aspect = img ? img.width / img.height : 1;
    const fw = (aspect >= w / h ? w : h * aspect) * SHRINK;
    const fh = (aspect >= w / h ? w / aspect : h) * SHRINK;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rot * Math.PI) / 180);
    if (img) {
      ctx.drawImage(img, -fw / 2, -fh / 2, fw, fh);
    } else {
      ctx.fillStyle = "#efe9ff";
      ctx.beginPath();
      ctx.roundRect(-fw / 2, -fh / 2, fw, fh, Math.min(fw, fh) * 0.3);
      ctx.fill();
      ctx.fillStyle = "#b8a9f5";
      ctx.font = `600 ${Math.round(Math.min(fw, fh) * 0.22)}px Fredoka, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✨", 0, 0);
    }
    ctx.restore();
  });
  return c.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
