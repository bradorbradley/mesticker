#!/usr/bin/env node
/**
 * Windows twin of print-mac.mjs: press Print & Cut in StixCut for Windows, hands-off.
 *
 *   node print-win.mjs "<path>\sheet-1.stixcut"   open the sheet in a fresh StixCut, press Print & Cut
 *   node print-win.mjs --status                    what StixCut's print queue shows now
 *
 * Exits 0 once the printer has taken the job; prints the JSON result from
 * windows/stixcut-print.ps1 ({ ok, stage, openMs, startedMs } or { ok:false, error }).
 */
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PS1 = join(dirname(fileURLToPath(import.meta.url)), "windows", "stixcut-print.ps1");

export function stixcut(args, timeoutMs = 600_000) {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", PS1, ...args], { windowsHide: true, timeout: timeoutMs }, (err, stdout, stderr) => {
      const line = String(stdout).trim().split(/\r?\n/).filter((l) => l.startsWith("{")).pop();
      try {
        resolve(JSON.parse(line));
      } catch {
        resolve({ ok: false, stage: "script", error: (String(stderr).trim().split(/\r?\n/)[0] || err?.message || "no output").slice(0, 300) });
      }
    });
  });
}

export const pressPrint = (sheetPath) => stixcut(["-Sheet", sheetPath]);
export const stixcutStatus = () => stixcut(["-Status"], 30_000);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: print-win.mjs "<sheet.stixcut>" | --status');
    process.exit(2);
  }
  const r = arg === "--status" ? await stixcutStatus() : await pressPrint(arg);
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
}
