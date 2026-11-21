#!/usr/bin/env node
/**
 * Build StixCut layout files (.stixcut, JSON, schemaVersion 4) for an order
 * that station.mjs downloaded, so a sheet opens in StixCut fully arranged:
 * every sticker at its exact spot and size, with its kiss-cut line traced
 * from the sticker's outline. No dragging, no guessing.
 *
 *   node stixcut-layout.mjs <orderId>        → ~/MeSticker Orders/<id>/sheet-N.stixcut
 *   open -a StixCut "~/MeSticker Orders/<id>/sheet-1.stixcut"
 *
 * Units in the file: 96 per inch (4×7" paper = 384 × 672). Placement
 * positions are the sticker's centre. Cut paths are normalized 0–1 over the
 * sticker image ({ p, i, o } = point and its two bezier handles).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const U = 96; // file units per inch
// printable area on 4×7" PixCut paper (3.9×6.7") starts this far in
const OFFSET_X = 0.05, OFFSET_Y = 0.15;

const SETTINGS = {
  background: { color: "#FFFFFF" },
  backgroundUsesGlobalDefault: true,
  canvasLandscape: false,
  customHeightInches: 7,
  customSupportsCut: true,
  customWidthInches: 4,
  // the stickers already carry a white die-cut border: cut just outside it,
  // small enough that neighbours (≥2.5mm apart) never merge
  cutMarginMM: 0.4,
  mediaType: "printAndCut",
  overcutExtensionMM: 0.8,
  overcutExteriorCorners: false,
  packAllowsRotation: false,
  packMaxStickerSizeMM: 60,
  perfCut: { dashLengthMM: 8, dashSpacingMM: 0.05, enabled: false }, // kiss cut only
  preferTopDownPerfCutting: true,
  safetyMarginMM: 0.8,
  stickerGapMM: 2,
};

/** Outer outline of the sticker's opaque area, normalized 0–1, simplified. */
async function traceOutline(path) {
  const MAX = 400; // trace on a small copy: plenty for a ~1–2" cut line
  const meta = await sharp(path).metadata();
  const s = Math.min(1, MAX / Math.max(meta.width, meta.height));
  const w = Math.max(2, Math.round(meta.width * s)), h = Math.max(2, Math.round(meta.height * s));
  const alpha = await sharp(path).ensureAlpha().resize(w, h, { fit: "fill" }).extractChannel(3).raw().toBuffer();
  // pad by 1 so the outline never touches the edge
  const W = w + 2, H = h + 2;
  const m = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[(y + 1) * W + x + 1] = alpha[y * w + x] > 48 ? 1 : 0;
  // Moore-neighbour boundary trace from the top-left-most solid pixel
  let start = -1;
  for (let i = 0; i < W * H && start < 0; i++) if (m[i]) start = i;
  if (start < 0) throw new Error(`${path} has no opaque pixels`);
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const pts = [];
  let cx = start % W, cy = (start / W) | 0, dir = 7;
  for (let guard = 0; guard < W * H * 4; guard++) {
    pts.push([cx, cy]);
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8; // start looking left of where we came from
      const nx = cx + dirs[d][0], ny = cy + dirs[d][1];
      if (m[ny * W + nx]) {
        cx = nx;
        cy = ny;
        dir = d;
        found = true;
        break;
      }
    }
    if (!found || (cx === start % W && cy === ((start / W) | 0) && pts.length > 2)) break;
  }
  const simple = rdp(pts, 1.2);
  return simple.map(([x, y]) => {
    const p = [Math.min(1, Math.max(0, (x - 1 + 0.5) / w)), Math.min(1, Math.max(0, (y - 1 + 0.5) / h))];
    return { p, i: p, o: p };
  });
}

/** Ramer–Douglas–Peucker on a closed outline. */
function rdp(points, eps) {
  if (points.length < 4) return points;
  const simplify = (pts) => {
    if (pts.length < 3) return pts;
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
    let best = 0, idx = 0;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / len;
      if (d > best) {
        best = d;
        idx = i;
      }
    }
    if (best <= eps) return [pts[0], pts[pts.length - 1]];
    return [...simplify(pts.slice(0, idx + 1)).slice(0, -1), ...simplify(pts.slice(idx))];
  };
  const half = Math.floor(points.length / 2);
  return [...simplify(points.slice(0, half + 1)).slice(0, -1), ...simplify([...points.slice(half), points[0]]).slice(0, -1)];
}

async function stickerEntry(file, maxInches = 2.5) {
  // embed at print resolution (300 dpi of the largest spot it fills), not camera resolution:
  // a sheet file drops from ~9 MB to ~1–2 MB and StixCut prepares + uploads it much faster
  const px = Math.round(maxInches * 300);
  const src = readFileSync(file);
  const m0 = await sharp(src).metadata();
  const buf = Math.max(m0.width, m0.height) > px * 1.05
    ? await sharp(src).resize(px, px, { fit: "inside", kernel: "lanczos3" }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
    : src;
  const meta = await sharp(buf).metadata();
  const name = basename(file).replace(/\.png$/, "");
  return {
    borderColorHex: "#000000",
    cutLayers: [
      {
        appliesCutMargin: true,
        cornerRadiusMM: 0,
        cutMarginMM: SETTINGS.cutMarginMM,
        dieCut: false,
        id: randomUUID().toUpperCase(),
        kind: "imageTrace",
        mergeSingleOutline: false,
        name: "Cut 1",
        path: { subpaths: [{ c: true, n: await traceOutline(file) }] },
        perfCut: false,
        visible: true,
      },
    ],
    id: randomUUID().toUpperCase(),
    imageData: buf.toString("base64"),
    imageFileExtension: "png",
    name,
    originalFileName: `${name}.png`,
    preferredPlacementHeight: Math.round(meta.height * 3.84),
    preferredPlacementWidth: Math.round(meta.width * 3.84),
    sourceFileHash: createHash("sha256").update(buf).digest("hex"),
    sourceFileName: `${name}.png`,
  };
}

export async function buildLayouts(orderDir) {
  const order = JSON.parse(readFileSync(join(orderDir, "order.json"), "utf8"));
  // same sheets as last time (prepared while the guest paid)? reuse the files
  const key = createHash("sha256").update(JSON.stringify(order.sheets)).digest("hex");
  const cacheFile = join(orderDir, ".layout.json");
  try {
    const c = JSON.parse(readFileSync(cacheFile, "utf8"));
    if (c.key === key && c.out.every((s) => existsSync(s.path))) return c.out;
  } catch {}
  const out = [];
  for (const sheet of order.sheets) {
    const byFile = new Map();
    const biggest = new Map(); // largest spot (inches) each sticker file fills on this sheet
    for (const pl of sheet.placements) biggest.set(pl.file, Math.max(biggest.get(pl.file) ?? 0, pl.w, pl.h));
    for (const pl of sheet.placements) if (!byFile.has(pl.file)) byFile.set(pl.file, await stickerEntry(pl.file, biggest.get(pl.file)));
    const placements = sheet.placements.map((pl) => ({
      id: randomUUID().toUpperCase(),
      positionX: (OFFSET_X + pl.x + pl.w / 2) * U,
      positionY: (OFFSET_Y + pl.y + pl.h / 2) * U,
      quantity: 1,
      rasterOffsetX: 0,
      rasterOffsetY: 0,
      rasterRotationDegrees: 0,
      rasterScale: 1,
      rasterScaleY: 1,
      rotationDegrees: 0,
      sizeHeight: pl.h * U,
      sizeWidth: pl.w * U,
      stickerID: byFile.get(pl.file).id,
      visible: true,
    }));
    // StixCut requires a preview thumbnail; the guest-facing guide is exactly this sheet
    const preview = sheet.guide
      ? await sharp(sheet.guide).resize(293, 512, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).png().toBuffer()
      : await sharp({ create: { width: 293, height: 512, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const doc = {
      documentID: randomUUID().toUpperCase(),
      isTemplate: false,
      layoutLocked: false,
      placements,
      previewPNGData: preview.toString("base64"),
      schemaVersion: 4,
      settings: SETTINGS,
      stickers: [...byFile.values()],
    };
    const path = join(orderDir, `sheet-${sheet.sheet}.stixcut`);
    writeFileSync(path, JSON.stringify(doc));
    out.push({ sheet: sheet.sheet, path, stickers: placements.length, cutPoints: [...byFile.values()].map((s) => s.cutLayers[0].path.subpaths[0].n.length) });
  }
  writeFileSync(cacheFile, JSON.stringify({ key, out }));
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const id = process.argv[2];
  if (!id) {
    console.error("usage: stixcut-layout.mjs <orderId>");
    process.exit(2);
  }
  console.log(JSON.stringify(await buildLayouts(join(homedir(), "MeSticker Orders", id)), null, 2));
}
