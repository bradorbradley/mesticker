#!/usr/bin/env node
/**
 * Station autopilot: waits for the next paid order and gets it ready to print.
 *
 *   node autopilot.mjs [--include-unverified] [--auto-print]
 *
 * Every 2.5 s:
 *   1. claim the next paid order from the queue (the queue asks Stripe about
 *      orders the booth sent before payment);
 *   2. otherwise look for a paid booth checkout that never reached the queue
 *      (booth tab closed/paused) and rebuild it from the guest's uploaded sticker.
 * Then: clean → heal missing extras → build the StixCut sheets → open sheet 1,
 * and exit printing READY {id, sheets[]} so the agent can QC and press Print & Cut.
 * Handled checkouts are remembered in ~/MeSticker Orders/.handled so nothing prints twice.
 *
 * --auto-print (Mac): no agent in the loop. After the code checks below pass,
 * print-mac.mjs presses Print & Cut itself (~2 s), the guest's screen switches
 * to "Printing", each further sheet follows when the previous one is through,
 * the order is marked done and the loop keeps waiting. If the button can't be
 * found it falls back to READY for the agent, exactly as without the flag.
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
const autoPrint = process.argv.includes("--auto-print") && process.platform === "darwin";
const SHEET_SECONDS = Number(process.env.SHEET_SECONDS) || 130; // print + cut, measured ~2 min a sheet
const run = (script, ...args) => execFileSync("node", [join(HERE, script), ...args], { encoding: "utf8", env: process.env, maxBuffer: 1 << 26 });
const handled = () => new Set(existsSync(HANDLED) ? readFileSync(HANDLED, "utf8").split("\n").filter(Boolean) : []);
const remember = (...ids) => appendFileSync(HANDLED, ids.filter(Boolean).map((i) => i + "\n").join(""));
const log = (...a) => console.error(new Date().toLocaleTimeString(), ...a);

function fromQueue() {
  const { order } = JSON.parse(run("station.mjs", "next", ...(unverified ? ["--include-unverified"] : [])));
  if (!order) return null;
  // already printed from Stripe recovery before the booth's copy arrived: don't print twice
  if (order.checkoutId && handled().has(order.checkoutId)) {
    run("station.mjs", "done", order.id);
    log(`skipped ${order.id}: ${order.checkoutId} already printed`);
    return null;
  }
  return { id: order.id, checkoutId: order.checkoutId, recovered: false };
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
    if (Date.now() - paidAt < 40_000) continue; // the booth's own copy (all stickers, no regenerating) usually lands within ~25s
    log(`recovering ${s.id} (${s.sheets}) from ${img.url}`);
    run("recover.mjs", "build", s.id, img.url);
    return { id: s.id, checkoutId: s.id, recovered: true };
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Checks a person or agent would do, in code: every sheet is full and every sticker file is a real image. */
function qcProblems(sheets) {
  const problems = [];
  for (const s of sheets) {
    if (!existsSync(s.path)) problems.push(`sheet ${s.sheet + 1}: layout file missing`);
    if (!(s.stickers >= 1)) problems.push(`sheet ${s.sheet + 1}: no stickers`);
    if ((s.cutPoints ?? []).some((n) => !(n >= 8))) problems.push(`sheet ${s.sheet + 1}: a sticker has no usable cut line`);
  }
  return problems;
}

/** Press Print & Cut for each sheet in turn; false = hand the order to the agent instead. */
async function printAll(id, sheets) {
  const problems = qcProblems(sheets);
  if (problems.length) {
    log(`QC failed for ${id}: ${problems.join("; ")}`);
    return false;
  }
  for (let i = 0; i < sheets.length; i++) {
    if (i > 0) {
      execFileSync("open", ["-a", "StixCut", sheets[i].path]);
      await sleep(2500); // let the sheet load
    } else await sleep(1500);
    try {
      execFileSync("node", [join(HERE, "print-mac.mjs")], { encoding: "utf8", timeout: 40_000 });
    } catch (e) {
      log(`couldn't press Print & Cut on sheet ${i + 1} of ${id}: ${String(e.stdout || e.message).slice(0, 200)}`);
      return i === 0 ? false : (run("station.mjs", "failed", id, `auto-print stopped at sheet ${i + 1}`), true);
    }
    if (i === 0) run("station.mjs", "progress", id, "printing");
    log(`printing ${id} sheet ${i + 1}/${sheets.length}`);
    await sleep(SHEET_SECONDS * 1000); // the printer takes one sheet at a time
  }
  run("station.mjs", "done", id);
  log(`done ${id}`);
  return true;
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
    let healed;
    try {
      healed = JSON.parse(run("heal.mjs", got.id));
    } catch (e) {
      // e.g. image API out of credits: print with the stickers we have rather than not at all
      healed = { error: String(e.stderr || e.message).match(/Error: (.*)/)?.[1] ?? "heal failed" };
      log("heal failed, printing as is:", healed.error);
    }
    const sheets = JSON.parse(run("stixcut-layout.mjs", got.id));
    // Mac: StixCut opens the arranged sheet. Other platforms: the station agent takes it from READY.
    if (process.platform === "darwin") execFileSync("open", ["-a", "StixCut", sheets[0].path]);
    if (autoPrint && (await printAll(got.id, sheets))) continue;
    console.log("READY " + JSON.stringify({ id: got.id, recovered: got.recovered, dir, healed, sheets: sheets.map((s) => s.path) }));
    process.exit(0);
  }
  await sleep(2500); // a paid order is picked up within ~2.5 s
}
