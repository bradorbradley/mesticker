/**
 * Sticker sheet geometry for the Liene PixCut S1, shared by the booth (browser
 * canvas) and the MCP sheet renderer (sharp on the server).
 *
 * Paper is 4×7"; the printable area is 3.9×6.7", i.e. 1170×2010 px at 300 DPI.
 * Slots are [x, y, w, h, rotation°] in those pixels; each sticker is fitted
 * inside its box (keeping its own shape), shrunk a little so a tilt can't push
 * it into a neighbour, then rotated about the box centre.
 */

export const DPI = 300;
export const SHEET_W = Math.round(3.9 * DPI); // 1170
export const SHEET_H = Math.round(6.7 * DPI); // 2010
/** Paper the cutter needs between two stickers' cut lines (~2.5 mm). */
export const MIN_GAP_PX = 30;
export const SLOT_SHRINK = 0.92;

export type Slot = [number, number, number, number, number];

export const LAYOUTS = {
  /** one sticker, 8 times: hero + 7 smaller */
  collage8: [
    [50, 30, 780, 760, -4], [830, 50, 310, 340, 6], [840, 420, 290, 340, -5], [40, 830, 540, 540, 3],
    [610, 810, 520, 560, -3], [40, 1420, 350, 400, -6], [425, 1410, 330, 380, 5], [795, 1430, 335, 380, -2],
  ] as Slot[],
  /** five different stickers: hero + 4 of varied sizes */
  hero5: [
    [85, 30, 1000, 960, -3], [40, 1030, 560, 540, 4], [640, 1050, 490, 470, -5], [60, 1600, 470, 380, -4], [570, 1580, 560, 400, 3],
  ] as Slot[],
  /** six equal-ish stickers, 2 × 3, gently tilted */
  grid6: [
    [40, 40, 525, 610, -3], [605, 40, 525, 610, 3], [40, 700, 525, 610, 2], [605, 700, 525, 610, -2],
    [40, 1360, 525, 610, -3], [605, 1360, 525, 610, 3],
  ] as Slot[],
  /** one big sticker (~3.6") */
  big1: [[35, 335, 1100, 1340, 0]] as Slot[],
};
export type LayoutId = keyof typeof LAYOUTS;

export const LAYOUT_INFO: Record<LayoutId, string> = {
  collage8: "8 slots: one hero (~2.4\") + 7 smaller (1–1.8\"), mixed sizes and tilts. Best for one sticker repeated.",
  hero5: "5 slots: a big hero (~3\") on top + 4 varied minis (1.2–1.8\"). Best for 5 different stickers (poses/styles).",
  grid6: "6 slots of ~1.8×2\", 2 columns × 3 rows, gently tilted. Best for 6 different stickers of equal importance.",
  big1: "1 slot: a single ~3.6\" sticker.",
};

type Pt = [number, number];

/** Corner points of a sticker with the given aspect (w/h) placed in a slot. */
export function stickerQuad([x, y, w, h, rot]: Slot, aspect: number): Pt[] {
  const fw = (aspect >= w / h ? w : h * aspect) * SLOT_SHRINK;
  const fh = (aspect >= w / h ? w / aspect : h) * SLOT_SHRINK;
  const cx = x + w / 2, cy = y + h / 2, a = (rot * Math.PI) / 180;
  return ([[-fw / 2, -fh / 2], [fw / 2, -fh / 2], [fw / 2, fh / 2], [-fw / 2, fh / 2]] as Pt[]).map(([dx, dy]) => [
    cx + dx * Math.cos(a) - dy * Math.sin(a),
    cy + dx * Math.sin(a) + dy * Math.cos(a),
  ]);
}

/** Separation between two convex quads (negative = overlapping). */
function separation(p: Pt[], q: Pt[]) {
  let best = -Infinity;
  for (const poly of [p, q]) {
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % 4];
      let nx = y2 - y1, ny = x1 - x2;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      const a = p.map(([u, v]) => u * nx + v * ny), b = q.map(([u, v]) => u * nx + v * ny);
      best = Math.max(best, Math.min(...b) - Math.max(...a), Math.min(...a) - Math.max(...b));
    }
  }
  return best;
}

/**
 * Check a layout against the real sticker shapes: every pair must keep
 * MIN_GAP_PX of paper and every sticker must stay on the printable area.
 */
export function checkLayout(slots: Slot[], aspects: number[]): string[] {
  const problems: string[] = [];
  const quads = slots.map((s, i) => stickerQuad(s, aspects[i] ?? aspects[0] ?? 1));
  quads.forEach((q, i) => {
    if (q.some(([x, y]) => x < 10 || y < 10 || x > SHEET_W - 10 || y > SHEET_H - 10)) problems.push(`slot ${i + 1} runs off the printable area`);
  });
  for (let i = 0; i < quads.length; i++) {
    for (let j = i + 1; j < quads.length; j++) {
      const gap = separation(quads[i], quads[j]);
      if (gap < MIN_GAP_PX) problems.push(`slots ${i + 1} and ${j + 1} are ${gap < 0 ? "overlapping" : `only ${Math.round(gap)}px apart`} (need ${MIN_GAP_PX}px ≈ 2.5mm)`);
    }
  }
  return problems;
}
