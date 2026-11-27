"use client";

/**
 * Direct-print test bench: this page talks to the PixCut S1 itself, over USB (WebUSB) or
 * Bluetooth (Web Bluetooth). No laptop script, no StixCut. Used to find out which devices
 * and browsers can run the booth on their own.
 */
import { useEffect, useRef, useState } from "react";
import * as usb from "../../../../hardware/station/pixcut/webusb.mjs";
import * as ble from "../../../../hardware/station/pixcut/ble.mjs";
import * as fast from "../../../../hardware/station/pixcut/stream.mjs";
import { PixCut, describeAlerts } from "../../../../hardware/station/pixcut/protocol.mjs";

type Status = { state: number; sub: number; alerts: number[]; label: string; subLabel: string };
type JobUpdate = { phase: string; text: string; progress?: number };
type Printer = {
  status(): Promise<Status>;
  printAndCut(jpeg: Uint8Array, plt: Uint8Array, o: { onStatus: (s: JobUpdate) => void; signal?: AbortSignal }): Promise<{ jobId: number }>;
};
type Link = { kind: "USB" | "Bluetooth" | "Fast Bluetooth"; printer: Printer; close: () => Promise<void> };

const TEST = { plt: "/booth/printer-test/sheet.plt", usb: "/booth/printer-test/sheet.jpg", ble: "/booth/printer-test/sheet-small.jpg" };
const bytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
const secs = (ms: number) => `${Math.round(ms / 1000)}s`;

export default function PrinterBench() {
  const [can, setCan] = useState<{ usb: boolean; ble: boolean; fast: boolean } | null>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);

  const say = (line: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 200));

  useEffect(() => {
    setCan({ usb: usb.supported(), ble: ble.supported(), fast: fast.supported() });
  }, []);

  async function connect(kind: Link["kind"]) {
    setBusy(true);
    try {
      await link?.close();
      setLink(null);
      let next: Link;
      if (kind === "USB") {
        const dev = (await usb.findGranted()) ?? (await usb.requestPrinter());
        const { io, close } = await usb.openPrinter(dev);
        next = { kind, printer: new PixCut(io) as unknown as Printer, close };
      } else if (kind === "Fast Bluetooth") {
        const { printer, close } = await fast.openPrinter();
        next = { kind, printer: printer as unknown as Printer, close };
      } else {
        const dev = await ble.requestPrinter();
        say(`Bluetooth: connecting to ${dev.name ?? "printer"}`);
        const { printer, close } = await ble.openPrinter(dev);
        next = { kind, printer: printer as unknown as Printer, close };
      }
      const st = await next.printer.status();
      setLink(next);
      const line = `${st.label}${st.alerts.length ? ` · ${describeAlerts(st.alerts)}` : ""}`;
      setStatus(line);
      say(`${kind} connected. Printer is ${line}.`);
    } catch (e) {
      say(`${kind} connect failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!link) return;
    try {
      const st = await link.printer.status();
      const line = `${st.label} · ${st.subLabel}${st.alerts.length ? ` · ${describeAlerts(st.alerts)}` : ""}`;
      setStatus(line);
      say(`Status: ${line}`);
    } catch (e) {
      say(`Status failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function printTest() {
    if (!link) return;
    if (!window.confirm("Print and cut one test sheet? It uses one sheet of 4×7 sticker paper.")) return;
    setBusy(true);
    setProgress(0);
    abort.current = new AbortController();
    const t0 = Date.now();
    let uploaded = 0;
    try {
      const [jpeg, plt] = await Promise.all([bytes(link.kind === "USB" ? TEST.usb : TEST.ble), bytes(TEST.plt)]);
      say(`Sending ${Math.round((jpeg.length + plt.length) / 1024)} KB over ${link.kind}`);
      let last = "";
      const res = await link.printer.printAndCut(jpeg, plt, {
        signal: abort.current.signal,
        onStatus: (s) => {
          if (s.phase === "upload") {
            setProgress(s.progress ?? 0);
            if ((s.progress ?? 0) >= 1 && !uploaded) {
              uploaded = Date.now() - t0;
              say(`Upload finished in ${secs(uploaded)}`);
            }
          } else setProgress(null);
          if (s.text !== last && s.phase !== "upload") say(s.text);
          last = s.text;
          setStatus(s.text);
        },
      });
      say(`DONE: job ${res.jobId} printed and cut. Upload ${secs(uploaded)}, total ${secs(Date.now() - t0)}.`);
    } catch (e) {
      say(`FAILED after ${secs(Date.now() - t0)}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const btn = "rounded-xl px-4 py-3 text-base font-semibold disabled:opacity-40";
  return (
    <main className="mx-auto max-w-md space-y-5 p-5 text-neutral-900">
      <header>
        <h1 className="text-2xl font-extrabold">Printer test</h1>
        <p className="mt-1 text-sm text-neutral-600">Prints straight from this page to the PixCut S1. Close StixCut and the Liene app first: only one thing can hold the printer.</p>
      </header>

      {can && (
        <section className="space-y-2 rounded-2xl border border-neutral-200 p-4 text-sm">
          <p>
            <b>USB cable:</b> {can.usb ? "this browser can do it" : "not available in this browser"}
          </p>
          <p>
            <b>Bluetooth:</b> {can.ble ? "this browser can do it" : "not available in this browser"}
          </p>
          {!can.usb && !can.ble && <p className="text-neutral-600">On iPhone or iPad, open this page in the free Bluefy browser (App Store) for Bluetooth. On a laptop or Android, use Chrome.</p>}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <button className={`${btn} bg-violet-600 text-white`} disabled={busy || !can?.usb} onClick={() => connect("USB")}>
          Connect USB
        </button>
        <button className={`${btn} bg-violet-600 text-white`} disabled={busy || !can?.ble} onClick={() => connect("Bluetooth")}>
          Connect Bluetooth
        </button>
      </section>
      {can?.fast && (
        <button className={`${btn} w-full bg-pink-600 text-white`} disabled={busy} onClick={() => connect("Fast Bluetooth")}>
          Fast connect (app)
        </button>
      )}

      {link && (
        <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
          <p className="text-sm">
            <b>Connected by {link.kind}.</b> {status}
          </p>
          {progress != null && (
            <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full bg-violet-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button className={`${btn} border border-neutral-300`} disabled={busy} onClick={check}>
              Check status
            </button>
            <button className={`${btn} bg-pink-600 text-white`} disabled={busy} onClick={printTest}>
              Print test sheet
            </button>
          </div>
          {busy && progress != null && (
            <button className="text-sm underline" onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/booth/printer-test/preview.png" alt="Test sheet: 12 dog stickers with pink cut lines" className="mx-auto w-40 rounded-lg border border-neutral-200" />
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold">Log</h2>
        <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-100 p-3 text-xs">{log.join("\n") || "Nothing yet."}</pre>
      </section>
    </main>
  );
}
