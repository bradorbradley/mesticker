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
 *
 * Config: ~/.mesticker-station/env (chmod 600) with
 *   MCP_SECRET=<station key, same as Vercel's MCP_SECRET>
 *   BOOTH_URL=https://mesticker.fun        (optional)
 *
 * Orders land in ~/MeSticker Orders/<orderId>/  as 1.png … 8.png, guide.png
 * and order.json (sizes in inches). Prints a JSON summary on stdout so an
 * agent (Claude) can read it and drive StixCut.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

async function fetchOrder(order) {
  const dir = join(ORDERS, order.id);
  mkdirSync(dir, { recursive: true });
  const files = [];
  for (const it of [...order.items].sort((a, b) => a.n - b.n)) {
    const path = join(dir, `${it.n}.png`);
    await download(it.url, path);
    files.push({ n: it.n, path, w: it.w, h: it.h });
  }
  let guide = null;
  if (order.guideUrl) {
    guide = join(dir, "guide.png");
    await download(order.guideUrl, guide).catch(() => (guide = null));
  }
  const summary = { id: order.id, product: order.productId, verified: order.verified, attempts: order.attempts, kitUrl: order.kitUrl, dir, guide, files };
  writeFileSync(join(dir, "order.json"), JSON.stringify(summary, null, 2));
  return summary;
}

const [cmd, ...args] = process.argv.slice(2);
const cfg = loadConfig();

switch (cmd) {
  case "list": {
    const status = args[0];
    const { orders } = await api(cfg, "GET", null, status ? `?status=${encodeURIComponent(status)}` : "");
    console.log(JSON.stringify(orders.map((o) => ({ id: o.id, status: o.status, verified: o.verified, product: o.productId, created: o.createdAt, error: o.error })), null, 2));
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
    fail("usage: station.mjs list|next [--include-unverified]|done <id>|failed <id> <reason>|requeue <id>", 2);
}
