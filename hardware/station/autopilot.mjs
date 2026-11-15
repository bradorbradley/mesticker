#!/usr/bin/env node
/**
 * Station autopilot: waits for the next paid order and gets it ready to print.
 *
 *   node autopilot.mjs [--include-unverified]
 *
 * Every 5s:
 *   1. claim the next paid order from the queue (the queue asks Stripe about
 *      orders the booth sent before payment);
 *   2. otherwise look for a paid booth checkout that never reached the queue
 *      (booth tab closed/paused) and rebuild it from the guest's uploaded sticker.
 * Then: clean → heal missing extras → build the StixCut sheets → open sheet 1,
 * and exit printing READY {id, sheets[]} so the agent can QC and press Print & Cut.
 * Handled checkouts are remembered in ~/MeSticker Orders/.handled so nothing prints twice.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORDERS = join(homedir(), "MeSticker Orders");
const HANDLED = join(ORDERS, ".handled");
const unverified = process.argv.includes("--include-unverified");
const run = (script, ...args) => execFileSync("node", [join(HERE, script), ...args], { encoding: "utf8", env: process.env, maxBuffer: 1 << 26 });
const handled = () => new Set(existsSync(HANDLED) ? readFileSync(HANDLED, "utf8").split("\n").filter(Boolean) : []);
const remember = (...ids) => appendFileSync(HANDLED, ids.filter(Boolean).map((i) => i + "\n").join(""));
const log = (...a) => console.error(new Date().toLocaleTimeString(), ...a);

function fromQueue() {
  const { order } = JSON.parse(run("station.mjs", "next", ...(unverified ? ["--include-unverified"] : [])));
  return order ? { id: order.id, checkoutId: null, sheets: order.sheets } : null;
}

function fromStripe() {
  let data;
  try {
    data = JSON.parse(run("recover.mjs", "list", "120"));
  } catch {
    return null; // recovery endpoint not reachable: queue only
  }
  const done = handled();
  const queued = new Set(JSON.parse(run("station.mjs", "list")).map((o) => o.checkoutId).filter(Boolean));
  for (const s of data.sessions ?? []) {
    if (done.has(s.id) || queued.has(s.id)) continue;
    const paidAt = Date.parse(s.created);
    // the guest's main sticker is uploaded on reveal, minutes before paying
    const img = (data.images ?? [])
      .filter((i) => Date.parse(i.uploadedAt) <= paidAt + 5000 && Date.parse(i.uploadedAt) > paidAt - 20 * 60_000)
      .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))[0];
    if (!img) continue;
    if (Date.now() - paidAt < 90_000) continue; // give the booth 90s to send it the normal way
    log(`recovering ${s.id} (${s.sheets}) from ${img.url}`);
    run("recover.mjs", "build", s.id, img.url);
    return { id: s.id, checkoutId: s.id };
  }
  return null;
}

for (;;) {
  let got = null;
  try {
    got = fromQueue() || fromStripe();
  } catch (e) {
    log("check failed:", e.message.split("\n")[0]);
  }
  if (got) {
    remember(got.id, got.checkoutId);
    const dir = join(ORDERS, got.id);
    run("station.mjs", "clean", got.id);
    const healed = JSON.parse(run("heal.mjs", got.id));
    const sheets = JSON.parse(run("stixcut-layout.mjs", got.id));
    execFileSync("open", ["-a", "StixCut", sheets[0].path]);
    console.log("READY " + JSON.stringify({ id: got.id, recovered: !!got.checkoutId, dir, healed, sheets: sheets.map((s) => s.path) }));
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
