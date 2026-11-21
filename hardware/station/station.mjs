#!/usr/bin/env node
/**
 * MeSticker print station: talks to the booth print queue (/api/booth/queue)
 * and downloads each order's images for printing in StixCut.
 *
 *   node station.mjs list [queued|printing|done|failed]
 *   node station.mjs next [--include-unverified]   claim the next order + download it
 *   node station.mjs done <orderId>
 *   node station.mjs failed <orderId> "<reason>"
 *   node station.mjs requeue <orderId>
 *   node station.mjs progress <orderId> printing     the guest's screen shows "Printing…" (run it the moment Print & Cut is pressed)
 *
 * Config: ~/.mesticker-station/env (chmod 600) with
 *   MCP_SECRET=<station key, same as Vercel's MCP_SECRET>
 *   BOOTH_URL=https://mesticker.fun        (optional)
 *
 * Orders land in ~/MeSticker Orders/<orderId>/ (stickers/, a guide per sheet,
 * order.json with every placement in inches). Prints the JSON summary on
 * stdout so an agent (Claude) can read it and drive StixCut.
 */
import { readFileSync, mkdirSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const HOME = homedir();
const CONFIG = process.env.STATION_CONFIG || join(HOME, ".mesticker-station", "env");
const ORDERS = join(HOME, "MeSticker Orders");
const ALLOWED_HOSTS = [".public.blob.vercel-storage.com", "mesticker.fun"];

function loadConfig() {
  let text = "";
  try {
    text = readFileSync(CONFIG, "utf8");
  } catch {
    fail(`No config at ${CONFIG}. Put MCP_SECRET=<station key> in it (chmod 600).`);
  }
  const env = Object.fromEntries(
    text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
  if (!env.MCP_SECRET) fail(`MCP_SECRET is missing from ${CONFIG}.`);
  return { key: env.MCP_SECRET, base: (env.BOOTH_URL || "https://mesticker.fun").replace(/\/$/, "") };
}

function fail(msg, code = 1) {
  console.error(`station: ${msg}`);
  process.exit(code);
}

async function api(cfg, method, body, query = "") {
  const res = await fetch(`${cfg.base}/api/booth/queue${query}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) fail(`${method} queue → ${res.status} ${data.error ?? ""}`.trim());
  return data;
}

function allowed(url) {
  try {
    const u = new URL(url);
    // local testing against `next dev`
    if (cfg.base.startsWith("http://localhost") && u.protocol === "http:" && u.hostname === "localhost") return true;
    return u.protocol === "https:" && ALLOWED_HOSTS.some((h) => u.hostname === h.replace(/^\./, "") || u.hostname.endsWith(h));
  } catch {
    return false;
  }
}

async function download(url, path) {
  if (!allowed(url)) throw new Error(`refusing to download from ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error(`suspiciously small file from ${url}`);
  writeFileSync(path, buf);
  return buf.length;
}

/**
 * Download an order: each distinct sticker once (stickers repeat across
 * slots and sheets), one guide per sheet, and a placement plan per sheet.
 *   ~/MeSticker Orders/<id>/stickers/s01.png …
 *   ~/MeSticker Orders/<id>/sheet-1-guide.png …
 *   ~/MeSticker Orders/<id>/order.json  → sheets[].placements[] { n, file, x, y, w, h } (inches)
 */
/**
 * Clean a sticker for the cutter: AI images leave faint haze and tiny
 * specks around the border, and StixCut's auto-trace would cut each speck
 * as its own sticker (messy, and paper bits can jam). Drops near-invisible
 * alpha and any blob smaller than 0.3% of the sticker. Real detached bits
 * (music notes, hearts) are far bigger and stay. Returns specks removed.
 */
async function cleanSticker(path) {
  const img = sharp(path).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const solid = (i) => data[i * C + 3] > 48;
  const label = new Int32Array(W * H).fill(-1);
  const sizes = [];
  for (let i = 0; i < W * H; i++) {
    if (label[i] !== -1 || !solid(i)) continue;
    const id = sizes.length, stack = [i];
    let n = 0;
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      n++;
      const x = p % W, y = (p / W) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && label[q] === -1 && solid(q)) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(n);
  }
  const min = Math.max(200, Math.max(0, ...sizes) * 0.003);
  let removed = 0;
  sizes.forEach((s) => s < min && removed++);
  for (let i = 0; i < W * H; i++) {
    const l = label[i];
    if (l === -1 || sizes[l] < min) data[i * C + 3] = 0;
  }
  await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toFile(path + ".tmp");
  renameSync(path + ".tmp", path);
  return removed;
}

async function fetchOrder(order) {
  const dir = join(ORDERS, order.id);
  const stickerDir = join(dir, "stickers");
  mkdirSync(stickerDir, { recursive: true });
  // url → cleaned file, kept across calls: the station prepares an order while the guest is
  // still paying (prefetch), and the claim after payment then downloads nothing again
  const cachePath = join(dir, ".stickers.json");
  let cache = {};
  try {
    cache = JSON.parse(readFileSync(cachePath, "utf8"));
  } catch {}
  const fileOf = new Map();
  const used = new Set(Object.values(cache));
  let next = 1;
  const freshName = () => {
    let p;
    do p = join(stickerDir, `s${String(next++).padStart(2, "0")}.png`);
    while (used.has(p));
    used.add(p);
    return p;
  };
  const jobs = [];
  for (const it of order.items) {
    if (fileOf.has(it.url)) continue;
    if (cache[it.url] && existsSync(cache[it.url])) {
      fileOf.set(it.url, cache[it.url]);
      continue;
    }
    const path = freshName();
    fileOf.set(it.url, path);
    jobs.push((async () => {
      await download(it.url, path);
      const n = await cleanSticker(path);
      cache[it.url] = path;
      return n;
    })());
  }
  // all stickers at once (was one after another)
  const specks = (await Promise.all(jobs)).reduce((a, b) => a + b, 0);
  writeFileSync(cachePath, JSON.stringify(cache));
  const guideUrls = order.guides?.length ? order.guides : order.guideUrl ? [order.guideUrl] : [];
  const sheetNames = String(order.productId || "").split("+");
  const count = Math.max(guideUrls.length, ...order.items.map((it) => (it.sheet ?? 0) + 1));
  const sheets = [];
  for (let s = 0; s < count; s++) {
    let guide = null;
    if (guideUrls[s]) {
      guide = join(dir, `sheet-${s + 1}-guide.png`);
      if (cache[`guide:${guideUrls[s]}`] !== guide || !existsSync(guide)) {
        await download(guideUrls[s], guide).then(() => (cache[`guide:${guideUrls[s]}`] = guide)).catch(() => (guide = null));
        writeFileSync(cachePath, JSON.stringify(cache));
      }
    }
    const placements = order.items
      .filter((it) => (it.sheet ?? 0) === s)
      .sort((a, b) => a.n - b.n)
      .map((it) => ({ n: it.n, file: fileOf.get(it.url), x: it.x ?? null, y: it.y ?? null, w: it.w, h: it.h }));
    sheets.push({ sheet: s + 1, design: sheetNames[s] ?? null, guide, stickers: placements.length, placements });
  }
  const summary = {
    id: order.id,
    designs: order.productId,
    verified: order.verified,
    checkoutId: order.checkoutId ?? null,
    attempts: order.attempts,
    kitUrl: order.kitUrl,
    dir,
    uniqueStickers: fileOf.size,
    specksRemoved: specks,
    sheets,
  };
  writeFileSync(join(dir, "order.json"), JSON.stringify(summary, null, 2));
  return summary;
}

const [cmd, ...args] = process.argv.slice(2);
const cfg = loadConfig();

switch (cmd) {
  case "clean": {
    // re-clean an order that's already downloaded
    const { readdirSync } = await import("node:fs");
    const dir = join(ORDERS, String(args[0] ?? ""), "stickers");
    const out = {};
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".png")).sort()) out[f] = await cleanSticker(join(dir, f));
    console.log(JSON.stringify({ specksRemoved: out }));
    break;
  }
  case "prefetch": {
    // Orders the booth sent before payment (unverified, with a Stripe checkout, recent):
    // download and clean their stickers now, so printing starts sooner once they're paid.
    // Doesn't claim anything. Prints the ids it prepared.
    const { orders } = await api(cfg, "GET", null, "?status=queued");
    const fresh = orders.filter((o) => !o.verified && o.checkoutId && Date.now() - Date.parse(o.createdAt) < 30 * 60_000 && o.items?.length);
    const done = [];
    for (const o of fresh) {
      try {
        await fetchOrder(o);
        done.push(o.id);
      } catch {}
    }
    console.log(JSON.stringify(done));
    break;
  }
  case "list": {
    const status = args[0];
    const { orders } = await api(cfg, "GET", null, status ? `?status=${encodeURIComponent(status)}` : "");
    console.log(JSON.stringify(orders.map((o) => ({ id: o.id, status: o.status, verified: o.verified, checkoutId: o.checkoutId, product: o.productId, created: o.createdAt, error: o.error })), null, 2));
    break;
  }
  case "next": {
    const { order } = await api(cfg, "POST", { action: "claim", includeUnverified: args.includes("--include-unverified") });
    if (!order) {
      console.log(JSON.stringify({ order: null }));
      break;
    }
    try {
      console.log(JSON.stringify({ order: await fetchOrder(order) }, null, 2));
    } catch (e) {
      // couldn't get the images: put it back so it isn't lost
      await api(cfg, "POST", { action: "requeue", id: order.id });
      fail(`${e.message} (order ${order.id} put back in the queue)`);
    }
    break;
  }
  case "progress": {
    const [id, stage] = args;
    if (!id || !["preparing", "printing"].includes(stage)) fail("usage: station.mjs progress <orderId> preparing|printing");
    const { ok } = await api(cfg, "POST", { action: "progress", id, stage });
    console.log(JSON.stringify({ id, stage, ok }));
    break;
  }
  case "done":
  case "failed":
  case "requeue": {
    const id = args[0];
    if (!id) fail(`usage: station.mjs ${cmd} <orderId>${cmd === "failed" ? ' "<reason>"' : ""}`);
    const { order } = await api(cfg, "POST", { action: cmd, id, error: args[1] });
    console.log(JSON.stringify({ id: order.id, status: order.status, error: order.error }));
    break;
  }
  default:
    fail("usage: station.mjs list|next [--include-unverified]|progress <id> preparing|printing|done <id>|failed <id> <reason>|requeue <id>", 2);
}
