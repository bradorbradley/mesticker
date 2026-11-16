#!/usr/bin/env node
/**
 * Press StixCut's Print & Cut without a person or an AI: macOS accessibility
 * (System Events via JXA) finds the button in StixCut's window and clicks it.
 * About 2 seconds, versus a minute or more of an agent taking screenshots.
 *
 *   node print-mac.mjs --inspect   list every button StixCut shows (to tune the match)
 *   node print-mac.mjs             click Print & Cut (and a confirm button if one pops up)
 *
 * Exit code 0 = clicked, 1 = not found (the caller falls back to the agent).
 *
 * One-time: System Settings → Privacy & Security → Accessibility → allow the
 * app that runs this (Terminal, iTerm, or Claude).
 *
 * The match is by button name/description; set STIXCUT_PRINT_BUTTON to the
 * exact name from --inspect if StixCut labels it differently.
 */
import { execFileSync } from "node:child_process";

const inspect = process.argv.includes("--inspect");
const wanted = process.env.STIXCUT_PRINT_BUTTON || "";

const jxa = `
const inspect = ${JSON.stringify(inspect)};
const wanted = ${JSON.stringify(wanted)}.toLowerCase();
const se = Application("System Events");
const app = Application("StixCut");
app.activate();
delay(0.6);
const proc = se.processes.byName("StixCut");
function buttons(root, depth, out) {
  if (depth > 10) return out;
  let kids = [];
  try { kids = root.uiElements(); } catch (e) { return out; }
  for (const k of kids) {
    let role = "", name = "", desc = "", enabled = true;
    try { role = k.role(); } catch (e) {}
    try { name = k.name() || ""; } catch (e) {}
    try { desc = k.description() || ""; } catch (e) {}
    try { enabled = k.enabled(); } catch (e) {}
    if (role === "AXButton") out.push({ el: k, name, desc, enabled });
    buttons(k, depth + 1, out);
  }
  return out;
}
function find(list, test) { return list.find((b) => b.enabled && test((b.name + " " + b.desc).toLowerCase().trim())); }
const wins = proc.windows();
if (!wins.length) { JSON.stringify({ ok: false, error: "StixCut has no open window" }); }
else {
  const all = buttons(wins[0], 0, []);
  if (inspect) { JSON.stringify({ ok: true, buttons: all.map((b) => ({ name: b.name, description: b.desc, enabled: b.enabled })) }); }
  else {
    const print = wanted ? find(all, (t) => t.includes(wanted)) : (find(all, (t) => /print\\s*(&|and)\\s*cut/.test(t)) || find(all, (t) => /^print\\b/.test(t)));
    if (!print) { JSON.stringify({ ok: false, error: "no Print & Cut button found", seen: all.map((b) => b.name || b.desc).filter(Boolean).slice(0, 40) }); }
    else {
      print.el.click();
      delay(1.2);
      // a confirm sheet or dialog may follow ("Print", "Start", "OK", "Continue")
      let confirmed = null;
      const after = proc.windows();
      for (const w of after) {
        const c = find(buttons(w, 0, []), (t) => /^(print|start|ok|continue|print & cut|print and cut)$/.test(t) && t !== (print.name + " " + print.desc).toLowerCase().trim());
        if (c) { c.el.click(); confirmed = c.name || c.desc; break; }
      }
      JSON.stringify({ ok: true, clicked: print.name || print.desc, confirmed });
    }
  }
}
`;

try {
  const out = execFileSync("osascript", ["-l", "JavaScript", "-e", jxa], { encoding: "utf8", timeout: 30_000 }).trim();
  const res = JSON.parse(out || "{}");
  console.log(JSON.stringify(res, null, inspect ? 2 : 0));
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e.stderr || e.message).split("\n")[0] }));
  process.exit(1);
}
