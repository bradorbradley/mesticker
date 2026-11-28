/**
 * Order sheet → what the PixCut S1 needs: a print JPEG and a PLT kiss-cut path.
 *
 * Every sticker goes at its exact spot and size from order.json (inches on the
 * 3.9×6.7" printable area, which starts 0.05" in and 0.15" down on 4×7" paper).
 * The cut is traced from the composed sheet's alpha: just outside each sticker's
 * white die-cut border (CUT.marginMm), with the same tracer the Liene app uses.
 *
 * QC runs before anything is sent. `issues` blocks printing; `warnings` don't.
 */
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { generateCutPath } from "./vendor/pixcut-trace/generate.ts";
import { SHEET, MAX_JPEG_BYTES } from "./protocol.mjs";

export const DPI = 300;
export const PRINTABLE = { x: 0.05, y: 0.15, w: 3.9, h: 6.7 }; // inches, on 4×7" paper
export const CUT = {
  marginMm: 0.5, // cut this far outside the white border
  knifePressure: 42, // the Liene app's value for sticker media (kiss cut)
  alphaThreshold: 64,
  minGapMm: 2.5, // paper between neighbouring cut lines
  edgeMm: 1.5, // keep cuts this far from the paper edge
};
export const STICKERS_PER_SHEET = 12;
export const LIGHT_JPEG_BYTES = 360 * 1024;
// distinct stickers each design needs (heal.mjs recipes): main + extras
const DISTINCT = { pose: 8, face: 8, best: 11 };

const MM = DPI / 25.4; // px per mm
const px = (inches) => Math.round(inches * DPI);

/** Box of a placement on the 1200×2100 sheet, in px. */
function boxOf(pl) {
  return { x: px(PRINTABLE.x + pl.x), y: px(PRINTABLE.y + pl.y), w: px(pl.w), h: px(pl.h) };
}

async function stickerStats(file, w, h) {
  const { data, info } = await sharp(file).ensureAlpha().resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer({ resolveWithObject: true });
  let opaque = 0, sum = 0, sum2 = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    if (data[i * 4 + 3] < 128) continue;
    opaque++;
    const l = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    sum += l;
    sum2 += l * l;
  }
  const mean = opaque ? sum / opaque : 0;
  return { coverage: opaque / (info.width * info.height), lumaStdev: opaque ? Math.sqrt(Math.max(0, sum2 / opaque - mean * mean)) : 0, buf: data, info };
}

function segDist(px0, py0, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px0 - ax) * dx + (py0 - ay) * dy) / l2)) : 0;
  return Math.hypot(px0 - (ax + t * dx), py0 - (ay + t * dy));
}

/** Smallest distance between two closed polylines (px). */
function polyDist(a, b) {
  let best = Infinity;
  for (const p of a) for (let j = 0; j < b.length; j++) {
    const q = b[j], r = b[(j + 1) % b.length];
    best = Math.min(best, segDist(p.x, p.y, q.x, q.y, r.x, r.y));
  }
  for (const p of b) for (let j = 0; j < a.length; j++) {
    const q = a[j], r = a[(j + 1) % a.length];
    best = Math.min(best, segDist(p.x, p.y, q.x, q.y, r.x, r.y));
  }
  return best;
}

const bbox = (poly) => {
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

/**
 * Build one sheet. `sheet` is an entry of order.json's `sheets`.
 * Returns { jpeg, plt, preview, qc: { ok, issues, warnings, stats } }.
 * @param {any} sheet
 * @param {{ light?: boolean, needGuide?: boolean, frame?: Buffer | null }} [opts]
 */
export async function buildSheet(sheet, { light = false, needGuide = true, frame = null } = {}) {
  const issues = [], warnings = [];
  const pls = [...sheet.placements].sort((a, b) => a.n - b.n);

  // booth sheets are 12 stickers + the handle pill; event sheets 11 (logo, hero, 8 poses, pill)
  if (pls.length < 6 || pls.length > 16) issues.push(`sheet ${sheet.sheet} has ${pls.length} stickers, expected 11–13`);
  const eps = 0.01;
  for (const pl of pls) {
    if (pl.x == null || pl.y == null || !(pl.w > 0) || !(pl.h > 0)) issues.push(`sticker ${pl.n} has no position/size`);
    else if (pl.x < -eps || pl.y < -eps || pl.x + pl.w > PRINTABLE.w + eps || pl.y + pl.h > PRINTABLE.h + eps) issues.push(`sticker ${pl.n} runs off the printable area`);
    if (!pl.file || (!Buffer.isBuffer(pl.file) && !existsSync(pl.file))) issues.push(`sticker ${pl.n} image is missing`);
  }
  if (!pls.some((p) => p.n === 1)) issues.push("no sticker in spot 1");
  const distinct = new Set(pls.map((p) => p.file)).size;
  const need = DISTINCT[sheet.design];
  if (need && distinct < need) warnings.push(`sheet ${sheet.sheet} (${sheet.design}) has ${distinct} distinct stickers, the design wants ${need}: extras missing, printing repeats`);
  if (issues.length) return { qc: { ok: false, issues, warnings } };

  // compose the 1200×2100 sheet, transparent where there is no sticker
  const layers = [];
  for (const pl of pls) {
    const b = boxOf(pl);
    let st;
    try {
      st = await stickerStats(pl.file, b.w, b.h);
    } catch (e) {
      issues.push(`sticker ${pl.n} image is broken (${e.message})`);
      continue;
    }
    if (st.coverage < 0.15) issues.push(`sticker ${pl.n} is blank or nearly empty (${Math.round(st.coverage * 100)}% filled)`);
    else if (st.lumaStdev < 6) issues.push(`sticker ${pl.n} is a flat block of colour, not a picture`);
    const input = await sharp(st.buf, { raw: { width: st.info.width, height: st.info.height, channels: 4 } }).png().toBuffer();
    layers.push({ input, left: b.x, top: b.y });
  }
  if (issues.length) return { qc: { ok: false, issues, warnings } };

  const { data } = await sharp({ create: { width: SHEET.w, height: SHEET.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raster = { width: SHEET.w, height: SHEET.h, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };

  const cut = generateCutPath(raster, {
    binarize: { mode: "alpha", alphaThreshold: CUT.alphaThreshold },
    dilation: CUT.marginMm,
    knifePressure: CUT.knifePressure,
    includeHoles: false,
    fillMethod: "fit",
  });

  // every sticker gets its own closed cut, none merged, none too close, none near the edge
  const owner = cut.contours.map((c) => {
    const bb = bbox(c.outer);
    const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    const hits = pls.filter((pl) => {
      const b = boxOf(pl);
      // overlaps the box by more than the margin
      return bb.x0 < b.x + b.w - 2 * MM && bb.x1 > b.x + 2 * MM && bb.y0 < b.y + b.h - 2 * MM && bb.y1 > b.y + 2 * MM;
    });
    const inside = pls.find((pl) => {
      const b = boxOf(pl);
      return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
    });
    return { bb, hits, n: inside?.n ?? hits[0]?.n ?? null };
  });
  owner.forEach((o, i) => {
    if (o.hits.length > 1) issues.push(`cut line ${i + 1} wraps stickers ${o.hits.map((h) => h.n).join(" and ")} together`);
    const edge = CUT.edgeMm * MM;
    if (o.bb.x0 < edge || o.bb.y0 < edge || o.bb.x1 > SHEET.w - edge || o.bb.y1 > SHEET.h - edge) issues.push(`cut line ${i + 1} (sticker ${o.n}) is within ${CUT.edgeMm} mm of the paper edge`);
  });
  for (const pl of pls) if (!owner.some((o) => o.n === pl.n)) issues.push(`sticker ${pl.n} got no cut line`);
  let minGap = Infinity;
  for (let i = 0; i < cut.contours.length; i++) for (let j = i + 1; j < cut.contours.length; j++) {
    if (owner[i].n === owner[j].n) continue; // detached bits of one sticker
    const a = owner[i].bb, b = owner[j].bb, g = CUT.minGapMm * MM;
    if (a.x1 + g < b.x0 || b.x1 + g < a.x0 || a.y1 + g < b.y0 || b.y1 + g < a.y0) continue; // far apart
    minGap = Math.min(minGap, polyDist(cut.contours[i].outer, cut.contours[j].outer));
  }
  const minGapMm = Number.isFinite(minGap) ? Math.round((minGap / MM) * 10) / 10 : null;
  if (minGapMm != null && minGapMm < CUT.minGapMm) issues.push(`two cut lines are only ${minGapMm} mm apart (need ${CUT.minGapMm})`);

  // print JPEG: sheet on white, padded onto the printer's 1216×2128 raster
  // an event's printed trim (printable-area sized) goes under the stickers; the cut path ignores it
  const stickersPng = await sharp(Buffer.from(data), { raw: { width: SHEET.w, height: SHEET.h, channels: 4 } }).png().toBuffer();
  const under = frame
    ? [{ input: await sharp(frame).resize(px(PRINTABLE.w), px(PRINTABLE.h), { fit: "fill" }).png().toBuffer(), left: px(PRINTABLE.x), top: px(PRINTABLE.y) }]
    : [];
  const flat = sharp({ create: { width: SHEET.w, height: SHEET.h, channels: 4, background: "#ffffff" } })
    .composite([...under, { input: stickersPng, left: 0, top: 0 }])
    .flatten({ background: "#ffffff" })
    .extend({ left: SHEET.padX, right: SHEET.padX, top: SHEET.padY, bottom: SHEET.padY, background: "#ffffff" });
  const flatBuf = await flat.png().toBuffer();
  let jpeg;
  // `light` is for Bluetooth, where every kilobyte costs time: smaller file, still print quality
  const limit = light ? LIGHT_JPEG_BYTES : MAX_JPEG_BYTES;
  for (const q of light ? [84, 78, 72, 66] : [95, 92, 88, 84, 80]) {
    jpeg = await sharp(flatBuf).jpeg({ quality: q, chromaSubsampling: light ? "4:2:0" : "4:4:4", mozjpeg: light }).toBuffer();
    if (jpeg.length <= limit) break;
  }
  if (jpeg.length > MAX_JPEG_BYTES) issues.push(`print image is ${jpeg.length} bytes, over the printer's 1 MiB`);

  // preview for a human: the print with the cut lines in magenta
  const svgPaths = cut.contours.map((c) => `<path d="M${c.outer.map((p) => `${p.x},${p.y}`).join("L")}Z" fill="none" stroke="#ff00aa" stroke-width="2"/>`).join("");
  const preview = await sharp(Buffer.from(data), { raw: { width: SHEET.w, height: SHEET.h, channels: 4 } })
    .flatten({ background: "#ffffff" })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}" height="${SHEET.h}">${svgPaths}</svg>`) }])
    .png()
    .toBuffer();

  // the guest's guide should show the same layout (rough check: aspect and existence)
  if (needGuide && (!sheet.guide || !existsSync(sheet.guide))) warnings.push(`sheet ${sheet.sheet} has no guide image to compare against`);

  return {
    jpeg,
    plt: Buffer.from(cut.plt, "latin1"),
    preview,
    qc: {
      ok: issues.length === 0,
      issues,
      warnings,
      stats: { stickers: pls.length, distinct, cutLines: cut.contours.length, minGapMm, jpegBytes: jpeg.length, pltBytes: cut.plt.length },
    },
  };
}

export function readOrder(dir) {
  return JSON.parse(readFileSync(`${dir}/order.json`, "utf8"));
}
