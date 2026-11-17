#!/usr/bin/env node
/**
 * Print + kiss-cut an order on a PixCut S1 straight over USB (Windows, and any OS with libusb).
 * No StixCut, no Liene app, no clicking.
 *
 *   node hardware/station/pixcut/print.mjs status              printer state, alerts, firmware
 *   node hardware/station/pixcut/print.mjs build <orderId>     write sheet-N-print.jpg / .plt / -preview.png + QC, send nothing
 *   node hardware/station/pixcut/print.mjs send <orderId> [--sheet N]   QC, then print + cut each sheet in turn
 *
 * Output files land next to order.json in ~/MeSticker Orders/<id>/.
 */
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSheet, readOrder } from "./sheet.mjs";
import { withPrinter } from "./usb.mjs";
import { describeAlerts } from "./protocol.mjs";

export const ORDERS = join(homedir(), "MeSticker Orders");
const stamp = () => new Date().toLocaleTimeString();

/** Build + QC every sheet of an order, writing the files. Returns [{ sheet, qc, jpeg, plt }]. */
export async function buildOrder(id, { only } = {}) {
  const dir = join(ORDERS, id);
  const order = readOrder(dir);
  const out = [];
  for (const sheet of order.sheets) {
    if (only && sheet.sheet !== only) continue;
    const b = await buildSheet(sheet);
    if (b.jpeg) {
      writeFileSync(join(dir, `sheet-${sheet.sheet}-print.jpg`), b.jpeg);
      writeFileSync(join(dir, `sheet-${sheet.sheet}.plt`), b.plt);
      writeFileSync(join(dir, `sheet-${sheet.sheet}-preview.png`), b.preview);
    }
    writeFileSync(join(dir, `sheet-${sheet.sheet}-qc.json`), JSON.stringify(b.qc, null, 2));
    out.push({ sheet: sheet.sheet, ...b });
  }
  return out;
}

/** Printer ready check. Returns { ready, reason, status }. */
export async function printerReady() {
  try {
    return await withPrinter(async (p) => {
      const st = await p.status();
      const ident = await p.identify().catch(() => ({}));
      if (st.alerts.length) return { ready: false, reason: describeAlerts(st.alerts), status: st, ident };
      if (st.state === 60) return { ready: false, reason: `printer error (${st.subLabel})`, status: st, ident };
      if (st.state === 40) return { ready: false, reason: "printer busy", status: st, ident };
      if (st.state === 50) return { ready: false, reason: "printer is off", status: st, ident };
      return { ready: true, status: st, ident };
    });
  } catch (e) {
    return { ready: false, reason: e.message };
  }
}

/**
 * Send built sheets one after another. Calls onEvent({ type, sheet, ... }):
 *   accepted (job declared + files uploaded = printer starts), status, finished, error.
 * Waits for each sheet to finish before sending the next (the printer holds one job).
 * Paper-out mid-job: keeps waiting (the job resumes when paper is loaded) and reports it.
 */
export async function sendSheets(built, { onEvent = () => {} } = {}) {
  return withPrinter(async (p) => {
    const results = [];
    for (const b of built) {
      let accepted = false, lastAlert = "";
      const r = await p.printAndCut(b.jpeg, b.plt, {
        onStatus: (s) => {
          if (!accepted && s.phase === "run") {
            accepted = true;
            onEvent({ type: "accepted", sheet: b.sheet, jobId: s.jobId, at: Date.now() });
          }
          const alert = s.alerts?.length ? describeAlerts(s.alerts) : "";
          if (alert && alert !== lastAlert) onEvent({ type: "alert", sheet: b.sheet, text: alert });
          lastAlert = alert;
          onEvent({ type: "status", sheet: b.sheet, text: s.text });
        },
      });
      if (!accepted) onEvent({ type: "accepted", sheet: b.sheet, jobId: r.jobId, at: Date.now() });
      if (!r.cut) onEvent({ type: "alert", sheet: b.sheet, text: "job finished but the printer never reported a cut phase" });
      onEvent({ type: "finished", sheet: b.sheet, jobId: r.jobId, cut: r.cut, at: Date.now() });
      results.push(r);
    }
    return results;
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, id, ...rest] = process.argv.slice(2);
  const only = rest.includes("--sheet") ? Number(rest[rest.indexOf("--sheet") + 1]) : undefined;
  if (cmd === "status") {
    console.log(JSON.stringify(await printerReady(), null, 2));
  } else if ((cmd === "build" || cmd === "send") && id) {
    const t0 = Date.now();
    const built = await buildOrder(id, { only });
    for (const b of built) console.error(`${stamp()} sheet ${b.sheet}: QC ${b.qc.ok ? "ok" : "FAILED"} ${JSON.stringify(b.qc.stats ?? {})}${b.qc.issues.length ? "\n  issues: " + b.qc.issues.join("; ") : ""}${b.qc.warnings.length ? "\n  warnings: " + b.qc.warnings.join("; ") : ""}`);
    console.error(`${stamp()} built in ${Date.now() - t0} ms`);
    if (cmd === "send") {
      if (built.some((b) => !b.qc.ok)) {
        console.error("not printing: QC failed");
        process.exit(3);
      }
      await sendSheets(built, { onEvent: (e) => console.error(stamp(), `sheet ${e.sheet}`, e.type, e.text ?? e.jobId ?? "") });
    }
    console.log(JSON.stringify(built.map((b) => ({ sheet: b.sheet, ...b.qc })), null, 2));
  } else {
    console.error("usage: print.mjs status | build <orderId> [--sheet N] | send <orderId> [--sheet N]");
    process.exit(2);
  }
}
