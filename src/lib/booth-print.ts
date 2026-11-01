/**
 * Print files for the Liene PixCut S1 (4×7" sheets, 3.9×6.7" printable).
 *
 *   addStickerBorder → the sticker with a thick white die-cut border plus a
 *                      faint grey hairline, so the printer's auto-contour has
 *                      a visible edge to cut along on white paper.
 *   composePrintSheet → portrait 1170×2010 px (300 DPI): one big sticker on
 *                      top, four minis below (same sticker, or 5 different).
 *
 * Runs in the browser via Canvas, like compose-sheet-client.ts.
 */

const DPI = 300;
export const SHEET_W = Math.round(3.9 * DPI); // 1170
export const SHEET_H = Math.round(6.7 * DPI); // 2010

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function silhouette(img: HTMLImageElement, color: string) {
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

export async function addStickerBorder(src: string, borderFraction = 0.035): Promise<string> {
  const img = await loadImage(src);
  const radius = Math.round(img.width * borderFraction);
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

/** Draw `img` contained in the box, trimmed to its visible pixels. */
function drawContained(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
}

/**
 * One PixCut sheet: images[0] big on top, images[1..4] as minis below.
 * Pass one image to repeat it (classic sheet) or five for a pose/style pack.
 */
export async function composePrintSheet(borderedSrcs: string[]): Promise<string> {
  const imgs = await Promise.all(borderedSrcs.map(loadImage));
  const at = (i: number) => imgs[i] ?? imgs[0];
  const c = document.createElement("canvas");
  c.width = SHEET_W;
  c.height = SHEET_H;
  const ctx = c.getContext("2d")!;

  const margin = 30;
  const gap = 24;
  const small = Math.floor((SHEET_W - margin * 2 - gap) / 2); // ≈543
  const big = Math.min(SHEET_W - margin * 2, SHEET_H - margin * 2 - gap * 2 - small * 2);

  drawContained(ctx, at(0), (SHEET_W - big) / 2, margin, big);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      drawContained(ctx, at(1 + row * 2 + col), margin + col * (small + gap), margin + big + gap + row * (small + gap), small);
    }
  }
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
