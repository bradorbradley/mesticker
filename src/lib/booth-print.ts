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

import { DPI, LAYOUTS, SHEET_H, SHEET_W, shrinkOf, type LayoutId } from "./sheet-layouts";

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
function trimTransparent(img: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement | HTMLImageElement {
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

/**
 * AI cut-outs leave faint haze and tiny specks around the character. Growing
 * a border from that makes a lumpy outline and stray islands, and the
 * cutter traces every one. Drop near-invisible alpha, then any blob smaller
 * than 0.3% of the sticker (real detached bits like music notes are far bigger).
 */
function cleanEdges(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const { data, width: W, height: H } = id;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 72) data[i] = 0;
  const label = new Int32Array(W * H).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (label[i] !== -1 || !data[i * 4 + 3]) continue;
    const n = sizes.length;
    const stack = [i];
    let count = 0;
    label[i] = n;
    while (stack.length) {
      const p = stack.pop()!;
      count++;
      const x = p % W, y = (p / W) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && label[q] === -1 && data[q * 4 + 3]) {
          label[q] = n;
          stack.push(q);
        }
      }
    }
    sizes.push(count);
  }
  const min = Math.max(200, Math.max(0, ...sizes) * 0.003);
  for (let i = 0; i < W * H; i++) if (label[i] !== -1 && sizes[label[i]] < min) data[i * 4 + 3] = 0;
  ctx.putImageData(id, 0, 0);
  return c;
}

export async function addStickerBorder(src: string, borderFraction = 0.035): Promise<string> {
  const loaded = await loadImage(src);
  const img = trimTransparent(cleanEdges(loaded));
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
export async function composePrintSheet(srcs: (string | null)[], layout: LayoutId, opts: { numbers?: boolean; frame?: string } = {}): Promise<string> {
  const slots = LAYOUTS[layout];
  const uniq = Array.from(new Set(srcs.filter((s): s is string => !!s)));
  const loaded = new Map(await Promise.all(uniq.map(async (s) => [s, await loadImage(s)] as const)));
  const frame = opts.frame ? await loadImage(opts.frame).catch(() => null) : null;
  const c = document.createElement("canvas");
  c.width = SHEET_W;
  c.height = SHEET_H;
  const ctx = c.getContext("2d")!;
  // the sheet's printed trim (event sheets), under the stickers
  if (frame) ctx.drawImage(frame, 0, 0, SHEET_W, SHEET_H);

  const SHRINK = shrinkOf(layout);
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
    if (opts.numbers) {
      // a numbered badge on each spot, matching the kit's image numbers
      const r = Math.max(38, Math.min(w, h) * 0.09);
      ctx.fillStyle = "#1a1a2e";
      ctx.beginPath();
      ctx.arc(x + r * 0.9, y + r * 0.9, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${Math.round(r * 1.2)}px Fredoka, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x + r * 0.9, y + r * 0.95);
    }
  });
  return c.toDataURL("image/png");
}

/**
 * One sticker as the Liene app wants it: trimmed to the character, on plain
 * white with breathing room, so its "Remove background" button gets a clean
 * cut-out and adds its own white contour.
 */
export async function stickerForLiene(src: string): Promise<string> {
  const img = trimTransparent(await loadImage(src));
  const pad = Math.round(Math.max(img.width, img.height) * 0.08);
  const c = document.createElement("canvas");
  c.width = img.width + pad * 2;
  c.height = img.height + pad * 2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, pad, pad);
  return c.toDataURL("image/png");
}

/** Aspect (w/h) of a sticker once its empty margin is trimmed. */
export async function trimmedAspect(src: string): Promise<number> {
  const img = trimTransparent(await loadImage(src));
  return img.width / img.height;
}

/**
 * Where a sticker sits on the sheet, in inches from the top-left of the
 * printable area (3.9×6.7"): its fitted box, centred in the slot. The print
 * station uses this to place each sticker in StixCut by numbers.
 */
export function slotPlacement(layout: LayoutId, i: number, aspect: number) {
  const [x, y, w, h] = LAYOUTS[layout][i];
  const SHRINK = shrinkOf(layout);
  const fw = (aspect >= w / h ? w : h * aspect) * SHRINK;
  const fh = (aspect >= w / h ? w / aspect : h) * SHRINK;
  const r = (px: number) => Math.round((px / DPI) * 100) / 100;
  return { x: r(x + (w - fw) / 2), y: r(y + (h - fh) / 2), w: r(fw), h: r(fh) };
}

/** How big a sticker ends up in a slot, in inches (for the arranging guide). */
export function slotInches(layout: LayoutId, i: number, aspect: number) {
  const [, , w, h] = LAYOUTS[layout][i];
  const SHRINK = shrinkOf(layout);
  const fw = (aspect >= w / h ? w : h * aspect) * SHRINK;
  const fh = (aspect >= w / h ? w / aspect : h) * SHRINK;
  const r = (px: number) => Math.round((px / DPI) * 10) / 10;
  return { w: r(fw), h: r(fh) };
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * A sticker with the guest's name on a ribbon across its bottom (event sheets). Drawn here, not
 * by the AI, so the name is always spelled right. `font` is a loaded CSS font family.
 */
export async function withNameRibbon(src: string, name: string, font: string): Promise<string> {
  const img = trimTransparent(await loadImage(src));
  const text = name.trim().slice(0, 16);
  const W = img.width, ribbonH = Math.round(W * 0.2);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = img.height + Math.round(ribbonH * 0.45);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const y = c.height - ribbonH, x0 = W * 0.08, x1 = W * 0.92, notch = ribbonH * 0.35;
  // tails, then the band
  ctx.fillStyle = "#7d1015";
  ctx.beginPath();
  ctx.moveTo(x0 - notch * 0.4, y + ribbonH * 0.2); ctx.lineTo(x0 + notch, y + ribbonH * 0.2); ctx.lineTo(x0 + notch, y + ribbonH); ctx.lineTo(x0 - notch * 0.4, y + ribbonH); ctx.lineTo(x0 + notch * 0.2, y + ribbonH * 0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x1 + notch * 0.4, y + ribbonH * 0.2); ctx.lineTo(x1 - notch, y + ribbonH * 0.2); ctx.lineTo(x1 - notch, y + ribbonH); ctx.lineTo(x1 + notch * 0.4, y + ribbonH); ctx.lineTo(x1 - notch * 0.2, y + ribbonH * 0.6); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + ribbonH * 0.85);
  g.addColorStop(0, "#c8262d");
  g.addColorStop(1, "#931419");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x0, y, x1 - x0, ribbonH * 0.82, ribbonH * 0.12);
  ctx.fill();
  ctx.strokeStyle = "#e8c77d";
  ctx.lineWidth = Math.max(2, ribbonH * 0.05);
  ctx.stroke();
  let size = ribbonH * 0.62;
  ctx.font = `${size}px ${font}`;
  while (ctx.measureText(text).width > (x1 - x0) * 0.86 && size > 8) {
    size -= 2;
    ctx.font = `${size}px ${font}`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fbefd5";
  ctx.shadowColor = "rgba(60,5,8,0.6)";
  ctx.shadowOffsetY = Math.max(1, ribbonH * 0.03);
  ctx.fillText(text, W / 2, y + ribbonH * 0.43);
  return c.toDataURL("image/png");
}
