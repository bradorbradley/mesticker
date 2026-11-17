#!/usr/bin/env node
/**
 * Rebuild an order that was paid but never reached the print queue (the
 * booth tab was paused or closed before it sent the order).
 *
 *   node recover.mjs list [minutes]                   → paid booth checkouts + recent sticker uploads
 *   node recover.mjs build <checkoutId> <stickerUrl>  → ~/MeSticker Orders/<checkoutId>/order.json
 *
 * "build" downloads the guest's main sticker and lays out every sheet they paid
 * for with it in each slot; then run heal.mjs to make the poses/expressions,
 * and stixcut-layout.mjs to build the sheets.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const HOME = homedir();
const env = Object.fromEntries(
  readFileSync(process.env.STATION_CONFIG || join(HOME, ".mesticker-station", "env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
);
const base = (process.env.RECOVER_URL || env.RECOVER_URL || env.BOOTH_URL || "https://mesticker.fun").replace(/\/$/, "");
const headers = { Authorization: `Bearer ${env.MCP_SECRET}`, ...((process.env.VERCEL_SHARE_COOKIE || env.VERCEL_SHARE_COOKIE) ? { Cookie: process.env.VERCEL_SHARE_COOKIE || env.VERCEL_SHARE_COOKIE } : {}) };

const DPI = 300, SHRINK = 0.92;
const PACK12 = [
  [30, 30, 700, 700], [760, 30, 380, 335], [760, 395, 380, 335],
  [30, 760, 350, 420], [410, 760, 350, 420], [790, 760, 350, 420],
  [30, 1210, 350, 380], [410, 1210, 350, 380], [790, 1210, 350, 380],
  [30, 1620, 350, 360], [410, 1620, 350, 360], [790, 1620, 350, 360],
];
const placement = (i, aspect) => {
  const [x, y, w, h] = PACK12[i];
  const fw = (aspect >= w / h ? w : h * aspect) * SHRINK, fh = (aspect >= w / h ? w / aspect : h) * SHRINK;
  const r = (px) => Math.round((px / DPI) * 100) / 100;
  return { x: r(x + (w - fw) / 2), y: r(y + (h - fh) / 2), w: r(fw), h: r(fh) };
};

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "list") {
  const res = await fetch(`${base}/api/booth/recover?minutes=${Number(a) || 90}`, { headers });
  console.log(res.ok ? JSON.stringify(await res.json(), null, 2) : `recover ${res.status} ${(await res.text()).slice(0, 200)}`);
} else if (cmd === "build" && a && b) {
  const u = new URL(b);
  if (u.protocol !== "https:" || !u.hostname.endsWith(".public.blob.vercel-storage.com")) throw new Error("sticker must be a Vercel Blob URL");
  const { sessions = [] } = await (await fetch(`${base}/api/booth/recover?minutes=1440`, { headers })).json();
  const session = sessions.find((s) => s.id === a);
  if (!session) throw new Error(`${a} is not a paid booth checkout`);
  const dir = join(HOME, "MeSticker Orders", a);
  mkdirSync(join(dir, "stickers"), { recursive: true });
  const hero = join(dir, "stickers", "s01.png");
  writeFileSync(hero, Buffer.from(await (await fetch(b)).arrayBuffer()));
  const m = await sharp(hero).metadata();
  const sheets = String(session.sheets).split("+").map((design, s) => ({
    sheet: s + 1, design, guide: null, stickers: 12,
    placements: PACK12.map((_, i) => ({ n: i + 1, file: hero, ...placement(i, m.width / m.height) })),
  }));
  writeFileSync(join(dir, "order.json"), JSON.stringify({ id: a, designs: session.sheets, verified: true, recovered: true, dir, uniqueStickers: 1, sheets }, null, 2));
  console.log(JSON.stringify({ dir, sheets: session.sheets }));
} else {
  console.error("usage: recover.mjs list [minutes] | build <checkoutId> <stickerUrl>");
  process.exit(2);
}
