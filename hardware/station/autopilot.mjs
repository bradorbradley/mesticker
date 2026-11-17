#!/usr/bin/env node
/**
 * Station autopilot: waits for the next paid order and gets it printed.
 *
 *   node autopilot.mjs [--include-unverified] [--auto-print] [--direct]
 *
 * Every 2.5 s:
 *   1. claim the next paid order from the queue (the queue asks Stripe about
 *      orders the booth sent before payment);
 *   2. otherwise look for a paid booth checkout that never reached the queue
 *      (booth tab closed/paused) and rebuild it from the guest's uploaded sticker.
 * Then clean → heal missing extras → lay out the sheets, and one of:
 *
 *   (default, Mac) build the StixCut sheets, open sheet 1, exit printing
 *     READY {id, sheets[]} so the agent can QC and press Print & Cut.
 *   --auto-print (Mac): no agent in the loop. After the code checks pass,
 *     print-mac.mjs presses Print & Cut itself (~2 s), the guest's screen switches
 *     to "Printing", each further sheet follows when the previous one is through,
 *     the order is marked done and the loop keeps waiting. If the button can't be
 *     found it falls back to READY for the agent, exactly as without the flag.
 *   Windows (default): always hands-off through StixCut for Windows: print-win.mjs opens
 *     each sheet in a fresh StixCut and presses Print & Cut (UI Automation); no agent needed.
 *   --direct (backup, any OS with libusb): no StixCut. QC every sheet, then print +
 *     kiss-cut it on the PixCut S1 straight over USB (pixcut/print.mjs). The guest's
 *     screen switches to "Printing" the moment the printer takes sheet 1. Marks the
 *     order done and keeps waiting. A failed QC marks the order failed and alerts;
 *     nothing prints. Logs to ~/MeSticker Orders/station.log; alerts (log, Windows
 *     toast + beep, ~/MeSticker Orders/ALERT.txt) for printer offline / out of paper,
 *     queue unreachable, image API out of credits, QC and print failures.
 *
 * Handled checkouts are remembered in ~/MeSticker Orders/.handled so nothing prints twice.
 */
import { execFileSync, execFile } from "node:child_process";
import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORDERS = join(homedir(), "MeSticker Orders");
const HANDLED = join(ORDERS, ".handled");
const LOG = join(ORDERS, "station.log");
const ALERT = join(ORDERS, "ALERT.txt");
mkdirSync(ORDERS, { recursive: true });
const unverified = process.argv.includes("--include-unverified");
const WIN = process.platform === "win32";
const direct = process.argv.includes("--direct");
// Windows: StixCut + print-win.mjs is always hands-off (there is no agent to hand READY to)
const autoPrint = !direct && (WIN || (process.argv.includes("--auto-print") && process.platform === "darwin"));
const SHEET_SECONDS = Number(process.env.SHEET_SECONDS) || 130; // print + cut, measured ~2 min a sheet
const run = (script, ...args) => execFileSync(process.execPath, [join(HERE, script), ...args], { encoding: "utf8", env: process.env, maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] });
/** Fire-and-forget (never blocks the printer loop). */
const runAsync = (script, ...args) => new Promise((res) => execFile(process.execPath, [join(HERE, script), ...args], { env: process.env, windowsHide: true }, (e, out) => res(e ? null : out)));
const handled = () => new Set(existsSync(HANDLED) ? readFileSync(HANDLED, "utf8").split(/\r?\n/).filter(Boolean) : []);
const remember = (...ids) => appendFileSync(HANDLED, ids.filter(Boolean).map((i) => i + "\n").join(""));
const errText = (e) => String(e?.stderr || e?.message || e).trim().split("\n").filter(Boolean).pop() ?? "unknown error";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => {
  const line = `${new Date().toISOString()} ${a.join(" ")}`;
  console.error(line);
  if (direct || WIN) try { appendFileSync(LOG, line + "\n"); } catch {}
};

// ---- alerts: loud, but at most once per 10 minutes for the same problem
const lastAlert = new Map();
function alert(key, msg) {
  const now = Date.now();
  if (now - (lastAlert.get(key) ?? 0) < 10 * 60_000) return;
  lastAlert.set(key, now);
  log(`ALERT ${msg}`);
  try { appendFileSync(ALERT, `${new Date().toLocaleString()}  ${msg}\n`); } catch {}
  if (process.platform === "win32") {
    const safe = msg.replace(/[^\w .,:;()!?"\-/#%+]/g, " ").slice(0, 200);
    const ps = `[console]::beep(880,400);[console]::beep(660,400);` +
      `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;` +
      `$x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);` +
      `$t = $x.GetElementsByTagName('text'); $t.Item(0).AppendChild($x.CreateTextNode('MeSticker station')) > $null; $t.Item(1).AppendChild($x.CreateTextNode('${safe}')) > $null;` +
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))`;
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { windowsHide: true }, () => {});
  } else if (process.platform === "darwin") {
    execFile("osascript", ["-e", `display notification ${JSON.stringify(msg)} with title "MeSticker station" sound name "Basso"`], () => {});
  }
}
const clearAlert = (key, msg) => {
  if (lastAlert.has(key)) {
    lastAlert.delete(key);
    log(`OK ${msg}`);
  }
};

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
    return { id: s.id, checkoutId: s.id, recovered: true, paidAt };
  }
  return null;
}

/** Clean + heal. Heal failure (e.g. image API out of credits) prints with the stickers we have. */
function prepare(got) {
  run("station.mjs", "clean", got.id);
  try {
    return JSON.parse(run("heal.mjs", got.id));
  } catch (e) {
    const why = String(e.stderr || e.message).match(/Error: (.*)/)?.[1] ?? errText(e);
    const credits = /429|credit|quota|billing/i.test(why);
    alert(credits ? "credits" : "heal", credits
      ? `IMAGE API OUT OF CREDITS: order ${got.id} prints with repeats, and new guests may not get stickers. Top up OpenAI billing now. (${why})`
      : `couldn't make missing stickers for ${got.id}, printing with repeats: ${why}`);
    return { error: why };
  }
}

// ---------------- Mac / StixCut

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
      execFileSync("node", [join(HERE, "print-mac.mjs")], { encoding: "utf8", timeout: 60_000 });
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

/**
 * Windows: open each sheet in StixCut and press Print & Cut (print-win.mjs), no agent.
 * Sheet 1 failing = nothing printed: back in the queue + alert. Later sheet failing: order failed
 * with which sheets did print + alert. Never prints a sheet twice.
 */
async function printAllWindows(got, sheets) {
  const { pressPrint } = await import("./print-win.mjs");
  const t = { claimed: got.claimedAt };
  const problems = qcProblems(sheets);
  if (problems.length) {
    if (!got.recovered) try { run("station.mjs", "failed", got.id, `QC: ${problems.join("; ")}`.slice(0, 300)); } catch {}
    alert(`qc-${got.id}`, `ORDER ${got.id} NOT PRINTED, QC failed: ${problems.join("; ")}`);
    return;
  }
  for (let i = 0; i < sheets.length; i++) {
    const r = await pressPrint(sheets[i].path);
    if (!r.ok) {
      if (i === 0) {
        if (!got.recovered) {
          try { run("station.mjs", "requeue", got.id); } catch {}
          writeFileSync(HANDLED, [...handled()].filter((x) => x !== got.id && x !== got.checkoutId).join("\n") + "\n");
        }
        alert("print", `PRINT FAILED, nothing printed for ${got.id} (${r.stage}: ${r.error}).${got.recovered ? " Recovered order: reprint by hand." : " Put back in the queue."}`);
        await sleep(15_000);
      } else {
        if (!got.recovered) try { run("station.mjs", "failed", got.id, `printed sheet(s) 1-${i}; sheet ${i + 1}+ NOT printed: ${r.error}`.slice(0, 300)); } catch {}
        alert(`print-${got.id}`, `ORDER ${got.id} PARTLY PRINTED: sheets 1-${i} sent, sheet ${i + 1} failed (${r.error}). Reprint what's missing.`);
      }
      return;
    }
    if (i === 0) {
      t.started = Date.now();
      if (!got.recovered) runAsync("station.mjs", "progress", got.id, "printing");
    }
    log(`printing ${got.id} sheet ${i + 1}/${sheets.length} (StixCut open ${r.openMs} ms, printer took it at ${r.startedMs} ms)`);
  }
  if (!got.recovered) try { run("station.mjs", "done", got.id); } catch (e) { alert("mark", `couldn't mark ${got.id} done: ${errText(e)}`); }
  const timing = { id: got.id, recovered: got.recovered, sheets: sheets.length, claimToPrinterStartMs: t.started - t.claimed, ...(got.paidAt ? { paidToPrinterStartMs: t.started - got.paidAt } : {}) };
  log(`order ${got.id} DONE ${JSON.stringify(timing)}`);
  appendFileSync(join(ORDERS, "timings.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...timing }) + "\n");
}

/** The PixCut powers itself off after 20 min idle by default. Set its auto-off to Never (0). Needs StixCut closed. */
async function keepPrinterOn() {
  try {
    const { withPrinter } = await import("./pixcut/usb.mjs");
    await withPrinter(async (p) => {
      const cur = Number((await p.getProps(["auto-off-interval"]))["auto-off-interval"]);
      if (cur === 0) return log("printer auto-off already Never");
      const r = await p.request("set-prop", { "auto-off-interval": 0 });
      const now = Number((await p.getProps(["auto-off-interval"]))["auto-off-interval"]);
      log(`printer auto-off ${cur}s -> ${now === 0 ? "Never" : now + "s"} (error-code ${r?.result?.["error-code"]})`);
    });
  } catch (e) {
    log(`couldn't check printer auto-off: ${errText(e)}`);
  }
}

async function stixcutLoop() {
  const stixcutStatus = WIN ? (await import("./print-win.mjs")).stixcutStatus : null;
  const usb = WIN ? await import("./pixcut/print.mjs").catch(() => null) : null;
  if (WIN) {
    log(`station up (StixCut auto-print${unverified ? ", including unverified/free orders" : ", paid orders only"})`);
    if (usb && !(await stixcutStatus()).ok) await keepPrinterOn(usb);
  }
  let queueFails = 0;
  for (;;) {
    if (WIN) {
      // don't claim while the printer is missing or in error (a running job is fine: we wait for it)
      const s = await stixcutStatus();
      let problem = null;
      if (s.ok) {
        if (!s.ready && !s.busy) problem = `${s.printer || "not connected"}${s.message && typeof s.message === "string" ? ` (${s.message})` : ""}`;
      } else if (usb) {
        // StixCut closed: ask the printer itself over USB (also keeps it awake)
        const pr = await usb.printerReady();
        if (!pr.ready && !/busy/.test(pr.reason ?? "")) problem = pr.reason;
      }
      if (problem) {
        alert("printer", `PRINTER NOT READY: ${problem}. Turn it on / check paper and USB. Orders wait in the queue.`);
        await sleep(2500);
        continue;
      }
      clearAlert("printer", "printer ready again");
    }
    let got = null;
    try {
      got = fromQueue() || fromStripe();
      queueFails = 0;
      clearAlert("queue", "queue reachable again");
    } catch (e) {
      if (WIN && ++queueFails >= 3) alert("queue", `QUEUE UNREACHABLE (${queueFails} tries): ${errText(e)}`);
      else log("check failed:", errText(e));
    }
    if (got) {
      got.claimedAt = Date.now();
      remember(got.id, got.checkoutId);
      const dir = join(ORDERS, got.id);
      log(`order ${got.id}${got.recovered ? " (recovered from Stripe)" : ""} claimed`);
      if (WIN && !got.recovered) runAsync("station.mjs", "progress", got.id, "preparing");
      let healed, sheets;
      try {
        healed = prepare(got);
        sheets = JSON.parse(run("stixcut-layout.mjs", got.id));
      } catch (e) {
        if (!got.recovered) try { run("station.mjs", "failed", got.id, `station error: ${errText(e)}`.slice(0, 300)); } catch {}
        alert(`err-${got.id}`, `ORDER ${got.id} hit a station error, not printed: ${errText(e)}`);
        continue;
      }
      if (WIN) {
        await printAllWindows(got, sheets);
        continue;
      }
      if (process.platform === "darwin") execFileSync("open", ["-a", "StixCut", sheets[0].path]);
      if (autoPrint && (await printAll(got.id, sheets))) continue;
      console.log("READY " + JSON.stringify({ id: got.id, recovered: got.recovered, dir, healed, sheets: sheets.map((s) => s.path) }));
      process.exit(0);
    }
    await sleep(2500); // a paid order is picked up within ~2.5 s
  }
}

// ---------------- Direct USB (Windows station)

async function directLoop() {
  const { buildOrder, printerReady, sendSheets } = await import("./pixcut/print.mjs");
  log(`station up (direct USB${unverified ? ", including unverified/free orders" : ", paid orders only"})`);
  let queueFails = 0;
  for (;;) {
    // never claim an order the printer can't print right now: it stays first in line
    const pr = await printerReady();
    if (!pr.ready) {
      alert("printer", `PRINTER NOT READY: ${pr.reason}. Orders wait in the queue until it's fixed.`);
      await sleep(2500);
      continue;
    }
    clearAlert("printer", "printer ready again");

    let got = null;
    try {
      got = fromQueue() || fromStripe();
      queueFails = 0;
      clearAlert("queue", "queue reachable again");
    } catch (e) {
      if (++queueFails >= 3) alert("queue", `QUEUE UNREACHABLE (${queueFails} tries): ${errText(e)}`);
      else log("check failed:", errText(e));
    }
    if (got) await handle(got, { buildOrder, sendSheets });
    else await sleep(2500);
  }
}

async function handle(got, { buildOrder, sendSheets }) {
  const t = { claimed: Date.now() };
  remember(got.id, got.checkoutId);
  const mark = (status, reason) => {
    if (got.recovered) return; // recovered checkouts aren't in the queue
    try {
      run("station.mjs", status, got.id, ...(reason ? [reason.slice(0, 300)] : []));
    } catch (e) {
      alert("mark", `couldn't mark ${got.id} ${status}: ${errText(e)}`);
    }
  };
  log(`order ${got.id}${got.recovered ? " (recovered from Stripe)" : ""} claimed`);
  if (!got.recovered) runAsync("station.mjs", "progress", got.id, "preparing");
  try {
    const healed = prepare(got);
    t.prepared = Date.now();
    const built = await buildOrder(got.id);
    t.built = Date.now();
    for (const b of built) {
      log(`order ${got.id} sheet ${b.sheet}: QC ${b.qc.ok ? "ok" : "FAILED"} ${JSON.stringify(b.qc.stats ?? {})}`);
      for (const w of b.qc.warnings) log(`  warning: ${w}`);
    }
    const bad = built.filter((b) => !b.qc.ok);
    if (bad.length || !built.length) {
      const reason = bad.length ? bad.map((b) => `sheet ${b.sheet}: ${b.qc.issues.join("; ")}`).join(" | ") : "order has no sheets";
      mark("failed", `QC: ${reason}`);
      alert(`qc-${got.id}`, `ORDER ${got.id} NOT PRINTED, QC failed: ${reason}`);
      return;
    }
    if (healed?.error) log(`  printing ${got.id} with the stickers it has`);
    const accepted = [];
    try {
      await sendSheets(built, {
        onEvent: (e) => {
          if (e.type === "accepted") {
            accepted.push(e.sheet);
            if (!t.started) {
              t.started = e.at;
              if (!got.recovered) runAsync("station.mjs", "progress", got.id, "printing"); // guest's screen: games + progress bar
            }
            log(`order ${got.id} sheet ${e.sheet}: printing (job ${e.jobId}) ${e.at - t.claimed} ms after claim`);
          } else if (e.type === "alert") alert("printer-job", `PRINTER: ${e.text} (order ${got.id} sheet ${e.sheet}). Fix it and the job carries on.`);
          else if (e.type === "finished") log(`order ${got.id} sheet ${e.sheet}: done${e.cut ? "" : " (no cut phase seen!)"}`);
        },
      });
    } catch (e) {
      const why = errText(e);
      if (!accepted.length) {
        // nothing reached the paper: put it back so it isn't lost
        if (!got.recovered) {
          try { run("station.mjs", "requeue", got.id); } catch {}
          // let it be claimed again (not a double print: nothing printed)
          writeFileSync(HANDLED, [...handled()].filter((i) => i !== got.id && i !== got.checkoutId).join("\n") + "\n");
        }
        alert("print", `PRINT FAILED before anything printed for ${got.id}: ${why}.${got.recovered ? " Recovered order: reprint by hand." : " Put back in the queue."}`);
      } else {
        const missing = built.map((b) => b.sheet).filter((s) => !accepted.includes(s));
        mark("failed", `printed sheet(s) ${accepted.join(",")}; ${missing.length ? `sheet(s) ${missing.join(",")} NOT printed` : "last sheet errored mid-job"}: ${why}`);
        alert(`print-${got.id}`, `ORDER ${got.id} PARTLY PRINTED: sheets ${accepted.join(",")} sent, ${missing.length ? `sheets ${missing.join(",")} missing` : "last sheet errored mid-job"} (${why}). Check the printer and reprint what's missing.`);
      }
      return;
    }
    mark("done");
    t.finished = Date.now();
    const timing = {
      id: got.id,
      recovered: got.recovered,
      sheets: built.length,
      prepareMs: t.prepared - t.claimed,
      buildMs: t.built - t.prepared,
      claimToPrinterStartMs: t.started - t.claimed,
      ...(got.paidAt ? { paidToPrinterStartMs: t.started - got.paidAt } : {}),
      totalMs: t.finished - t.claimed,
    };
    log(`order ${got.id} DONE ${JSON.stringify(timing)}`);
    appendFileSync(join(ORDERS, "timings.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...timing }) + "\n");
  } catch (e) {
    mark("failed", `station error: ${errText(e)}`);
    alert(`err-${got.id}`, `ORDER ${got.id} hit a station error, not printed: ${errText(e)}`);
  }
}

if (direct) await directLoop();
else await stixcutLoop();
