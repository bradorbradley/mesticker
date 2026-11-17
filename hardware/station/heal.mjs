#!/usr/bin/env node
/**
 * Heal an order whose extra stickers never arrived (e.g. the guest paid on
 * their phone, Safari paused the booth tab, and the booth filled every
 * pose/expression slot with the main sticker). Regenerates the missing
 * stickers from the main sticker, adds the white die-cut border, cleans
 * them, and rewrites order.json so stixcut-layout.mjs builds the real sheet.
 *
 *   node heal.mjs <orderId>   → { healed: n, sheets: [...] }
 *
 * Detects missing extras by the sheet recipe: a slot that should hold an
 * extra but uses the hero's file is a fallback.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const HOME = homedir();
const ORDERS = join(HOME, "MeSticker Orders");
const CONFIG = process.env.STATION_CONFIG || join(HOME, ".mesticker-station", "env");
const base = (() => {
  try {
    const m = readFileSync(CONFIG, "utf8").match(/^BOOTH_URL=(.+)$/m);
    return (m ? m[1].trim() : "https://mesticker.fun").replace(/\/$/, "");
  } catch {
    return "https://mesticker.fun";
  }
})();

// Must match the booth (src/components/booth/booth-app.tsx, src/lib/sheet-layouts.ts)
const EXPRESSIONS = [
  "laughing out loud, eyes squeezed shut, huge open-mouth smile",
  "winking with a finger-gun and a cheeky grin",
  "heart eyes, hands clasped, totally in love",
  "shocked and surprised, mouth wide open, hands on cheeks",
  "too cool, wearing dark sunglasses, smug smirk, arms crossed",
  "happy tears of joy, crying-laughing",
  "pouty grumpy face, arms crossed, cheeks puffed (cute, not mean)",
];
const RECIPES = {
  pose: ["main", ["pose", 0], ["pose", 1], ["pose", 2], ["pose", 3], ["pose", 4], ["pose", 5], ["pose", 6], "main", ["pose", 0], ["pose", 3], ["pose", 5]],
  face: ["main", ["face", 0], ["face", 1], ["face", 2], ["face", 3], ["face", 4], ["face", 5], ["face", 6], "main", ["face", 0], ["face", 2], ["face", 4]],
  best: ["main", ["face", 0], ["pose", 0], ["pose", 1], ["face", 1], ["pose", 2], ["face", 2], ["pose", 3], ["face", 3], ["pose", 4], ["face", 4], "main"],
};
const DPI = 300, SHRINK = 0.92;
const PACK12 = [
  [30, 30, 700, 700], [760, 30, 380, 335], [760, 395, 380, 335],
  [30, 760, 350, 420], [410, 760, 350, 420], [790, 760, 350, 420],
  [30, 1210, 350, 380], [410, 1210, 350, 380], [790, 1210, 350, 380],
  [30, 1620, 350, 360], [410, 1620, 350, 360], [790, 1620, 350, 360],
];

function placement(i, aspect) {
  const [x, y, w, h] = PACK12[i];
  const fw = (aspect >= w / h ? w : h * aspect) * SHRINK;
  const fh = (aspect >= w / h ? w / aspect : h) * SHRINK;
  const r = (px) => Math.round((px / DPI) * 100) / 100;
  return { x: r(x + (w - fw) / 2), y: r(y + (h - fh) / 2), w: r(fw), h: r(fh) };
}

async function post(body) {
  const res = await fetch(`${base}/api/booth/pose`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`pose ${res.status} ${data.error ?? ""}`);
  return data;
}

/** White die-cut border like the booth's: grow the silhouette, put the sticker on top, trim. */
async function addBorder(png) {
  const meta = await sharp(png).metadata();
  const r = Math.round(Math.max(meta.width, meta.height) * 0.035);
  const pad = r + 6;
  const padded = await sharp(png).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const W = meta.width + pad * 2, H = meta.height + pad * 2;
  const alpha = await sharp(padded).extractChannel(3).blur(r / 2).threshold(8).raw().toBuffer();
  const white = await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  const out = await sharp(white).composite([{ input: padded }]).png().toBuffer();
  return sharp(out).trim({ threshold: 1 }).png().toBuffer();
}

async function heal(id) {
  const dir = join(ORDERS, id);
  const order = JSON.parse(readFileSync(join(dir, "order.json"), "utf8"));
  let healed = 0;
  for (const sheet of order.sheets) {
    const recipe = RECIPES[sheet.design];
    if (!recipe) continue;
    const hero = sheet.placements.find((p) => p.n === 1)?.file;
    const missing = new Set();
    recipe.forEach((src, i) => {
      const pl = sheet.placements.find((p) => p.n === i + 1);
      if (src !== "main" && pl?.file === hero) missing.add(`${src[0]}:${src[1]}`);
    });
    if (!missing.size) continue;
    const heroPng = readFileSync(hero);
    // the model wants a photo-like input: the hero on white
    const input = await sharp(heroPng).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
    const photo = `data:image/jpeg;base64,${input.toString("base64")}`;
    let poseIdeas = null;
    const made = new Map();
    await Promise.all(
      [...missing].map(async (key, k) => {
        const [kind, idx] = key.split(":");
        let idea;
        if (kind === "face") idea = EXPRESSIONS[Number(idx) % EXPRESSIONS.length];
        else {
          poseIdeas ??= post({ photo }).then((d) => d.ideas);
          const ideas = await poseIdeas;
          idea = ideas[Number(idx) % ideas.length];
        }
        await new Promise((r) => setTimeout(r, k * 300));
        let data;
        try {
          data = await post({ photo, styleId: "chibi", idea });
        } catch {
          data = await post({ photo, styleId: "chibi", idea }); // one retry
        }
        const raw = Buffer.from(String(data.image).replace(/^data:image\/\w+;base64,/, ""), "base64");
        const file = join(dir, "stickers", `healed-${kind}-${idx}.png`);
        writeFileSync(file, await addBorder(raw));
        made.set(key, file);
      })
    );
    for (const [i, src] of recipe.entries()) {
      if (src === "main") continue;
      const file = made.get(`${src[0]}:${src[1]}`);
      if (!file) continue;
      const pl = sheet.placements.find((p) => p.n === i + 1);
      const m = await sharp(file).metadata();
      Object.assign(pl, { file, ...placement(i, m.width / m.height) });
      healed++;
    }
  }
  writeFileSync(join(dir, "order.json"), JSON.stringify(order, null, 2));
  return { healed, sheets: order.sheets.map((s) => ({ sheet: s.sheet, distinct: new Set(s.placements.map((p) => p.file)).size })) };
}

const id = process.argv[2];
if (!id) {
  console.error("usage: heal.mjs <orderId>");
  process.exit(2);
}
console.log(JSON.stringify(await heal(id)));
