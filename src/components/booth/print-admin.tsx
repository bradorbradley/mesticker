"use client";

/**
 * Booth admin: this device holds the printer (USB or Bluetooth) and prints every paid
 * order by itself. It replaces the laptop station: claim from the queue → server builds
 * the sheet + cut path (/api/booth/print-job) → send to the PixCut S1 → mark done.
 *
 * The connection lives in this page, so the booth itself opens on top of it (an iframe)
 * instead of in another tab: a tab in the background gets suspended and stops printing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as usb from "../../../hardware/station/pixcut/webusb.mjs";
import * as ble from "../../../hardware/station/pixcut/ble.mjs";
import { PixCut, describeAlerts } from "../../../hardware/station/pixcut/protocol.mjs";
import type { QueueOrder } from "@/lib/booth-queue";

type Status = { state: number; sub: number; alerts: number[]; label: string; subLabel: string };
type JobUpdate = { phase: string; text: string; progress?: number };
type Printer = {
  status(): Promise<Status>;
  printAndCut(jpeg: Uint8Array, plt: Uint8Array, o: { onStatus: (s: JobUpdate) => void }): Promise<{ jobId: number }>;
};
type Kind = "USB" | "Bluetooth";
type Link = { kind: Kind; printer: Printer; close: () => Promise<void> };
type Current = { id: string; sheet: number; sheets: number; text: string; progress: number | null; preview?: string };
type PrintJob = { ok: boolean; issues: string[]; jpeg?: string; plt?: string; preview?: string; error?: string };

const KEY = "mesticker-station-key";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const printedKey = (id: string) => `mesticker-printed:${id}`;
const printedSheets = (id: string): number[] => {
  try {
    return JSON.parse(localStorage.getItem(printedKey(id)) ?? "[]");
  } catch {
    return [];
  }
};
const sheetsOf = (o: QueueOrder) => Math.max(o.guides.length, ...o.items.map((it) => (it.sheet ?? 0) + 1), 1);
const ago = (iso: string | null) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export default function PrintAdmin() {
  const [key, setKey] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [can, setCan] = useState({ usb: false, ble: false });
  const [link, setLink] = useState<Link | null>(null);
  const [printerLine, setPrinterLine] = useState("Not connected");
  const [connecting, setConnecting] = useState(false);
  const [auto, setAuto] = useState(true);
  const [eventFree, setEventFree] = useState<boolean | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [current, setCurrent] = useState<Current | null>(null);
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [queueError, setQueueError] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [booth, setBooth] = useState(false);

  // the print loop reads these, so it never works from a stale render
  const live = useRef({ key, link, auto, working: false });
  live.current = { ...live.current, key, link, auto };
  const lastDevice = useRef<{ kind: Kind; device: unknown } | null>(null);

  const say = useCallback((line: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 100)), []);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key");
    if (fromUrl) {
      localStorage.setItem(KEY, fromUrl);
      window.history.replaceState(null, "", window.location.pathname);
    }
    setKey(fromUrl ?? localStorage.getItem(KEY));
    setCan({ usb: usb.supported(), ble: ble.supported() });
  }, []);

  // keep the screen on: a sleeping phone drops the printer
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    const hold = async () => {
      if (document.visibilityState !== "visible" || !nav.wakeLock) return;
      try {
        lock = await nav.wakeLock.request("screen");
      } catch {
        /* low battery mode etc. */
      }
    };
    hold();
    document.addEventListener("visibilitychange", hold);
    return () => {
      document.removeEventListener("visibilitychange", hold);
      lock?.release().catch(() => {});
    };
  }, []);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(path, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${live.current.key}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Server said ${res.status}`);
    return data;
  }, []);
  const queue = useCallback((body: Record<string, unknown>) => api("/api/booth/queue", { method: "POST", body: JSON.stringify(body) }), [api]);

  const open = useCallback(async (kind: Kind, device: unknown): Promise<Link> => {
    if (kind === "USB") {
      const { io, close } = await usb.openPrinter(device as never);
      return { kind, printer: new PixCut(io) as unknown as Printer, close };
    }
    const { printer, close } = await ble.openPrinter(device as never);
    return { kind, printer: printer as unknown as Printer, close };
  }, []);

  async function connect(kind: Kind) {
    setConnecting(true);
    try {
      await live.current.link?.close().catch(() => {});
      setLink(null);
      const device = kind === "USB" ? ((await usb.findGranted()) ?? (await usb.requestPrinter())) : await ble.requestPrinter();
      const next = await open(kind, device);
      const st = await next.printer.status();
      lastDevice.current = { kind, device };
      setLink(next);
      setPrinterLine(statusLine(st));
      say(`Printer connected by ${kind}`);
    } catch (e) {
      say(`Couldn't connect by ${kind}: ${msg(e)}`);
    } finally {
      setConnecting(false);
    }
  }

  const statusLine = (st: Status) => (st.alerts.length ? `Needs attention: ${describeAlerts(st.alerts)}` : st.state === 20 || st.state === 30 ? "Ready" : `${st.label} · ${st.subLabel}`);

  /** Print every sheet of one claimed order. */
  const runOrder = useCallback(
    async (order: QueueOrder, l: Link) => {
      const total = sheetsOf(order);
      const t0 = Date.now();
      let sent = false; // true once a sheet's data is fully in the printer
      try {
        for (let s = 0; s < total; s++) {
          if (printedSheets(order.id).includes(s)) continue;
          sent = false;
          setCurrent({ id: order.id, sheet: s + 1, sheets: total, text: "Getting the sheet ready", progress: null });
          const job: PrintJob = await api(`/api/booth/print-job?id=${encodeURIComponent(order.id)}&sheet=${s}${l.kind === "Bluetooth" ? "&light=1" : ""}`);
          if (!job.ok || !job.jpeg || !job.plt) throw new Error(`Sheet ${s + 1} failed its check: ${job.issues.join("; ")}`);
          setCurrent({ id: order.id, sheet: s + 1, sheets: total, text: "Sending to printer", progress: 0, preview: job.preview });
          queue({ action: "progress", id: order.id, stage: "printing" }).catch(() => {});
          await l.printer.printAndCut(unb64(job.jpeg), unb64(job.plt), {
            onStatus: (u) => {
              if (u.phase === "upload" && (u.progress ?? 0) >= 1) sent = true;
              if (u.phase === "run") sent = true;
              setCurrent((c) => c && { ...c, text: u.phase === "upload" ? "Sending to printer" : u.text.replace(/^job \d+: /, ""), progress: u.phase === "upload" ? (u.progress ?? 0) : null });
            },
          });
          localStorage.setItem(printedKey(order.id), JSON.stringify([...printedSheets(order.id), s]));
        }
        await queue({ action: "done", id: order.id });
        localStorage.removeItem(printedKey(order.id));
        say(`Order ${order.id.slice(-6)} printed: ${total} sheet${total > 1 ? "s" : ""} in ${Math.round((Date.now() - t0) / 1000)}s`);
      } catch (e) {
        // nothing reached the printer and it's early: back in line. Otherwise stop and show it, so a sheet never prints twice by itself.
        const retry = !sent && order.attempts < 3;
        say(`Order ${order.id.slice(-6)} ${retry ? "will retry" : "FAILED"}: ${msg(e)}`);
        await queue({ action: retry ? "requeue" : "failed", id: order.id, error: msg(e).slice(0, 300) }).catch(() => {});
        if (retry) await sleep(4000);
      } finally {
        setCurrent(null);
      }
    },
    [api, queue, say]
  );

  // the loop: refresh the list, keep the printer, print what's paid
  useEffect(() => {
    if (!key) return;
    let alive = true;
    (async () => {
      while (alive) {
        try {
          const { orders } = await api("/api/booth/queue");
          if (alive) {
            setOrders(orders);
            setQueueError("");
          }
          const ev = await fetch("/api/booth/event", { cache: "no-store" }).then((r) => r.json());
          if (alive && !savingRef.current) setEventFree(ev.free === true);
        } catch (e) {
          if (alive) setQueueError(msg(e));
        }
        const { link: l, auto: on } = live.current;
        if (!l && lastDevice.current && !live.current.working) {
          // dropped (phone slept, cable bumped): take it back without a tap when the browser allows
          try {
            const { kind, device } = lastDevice.current;
            const dev = kind === "USB" ? ((await usb.findGranted()) ?? device) : device;
            const next = await open(kind, dev);
            await next.printer.status();
            setLink(next);
            say("Printer reconnected");
          } catch {
            setPrinterLine("Printer connection lost. Trying again… (tap Connect if this stays)");
          }
        } else if (l && !live.current.working) {
          live.current.working = true;
          try {
            const st = await l.printer.status();
            setPrinterLine(statusLine(st));
            const ready = (st.state === 20 || st.state === 30) && !st.alerts.length;
            if (ready && on) {
              const { order } = await queue({ action: "claim" });
              if (order) await runOrder(order, l);
            }
          } catch (e) {
            if (/lost|disconnect|GATT|no reply|device/i.test(msg(e))) {
              await l.close().catch(() => {});
              setLink(null);
              setPrinterLine("Printer connection lost. Trying again…");
              say(`Printer dropped: ${msg(e)}`);
            } else say(msg(e));
          } finally {
            live.current.working = false;
          }
        }
        await sleep(2500);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const savingRef = useRef(false);
  async function saveEvent(free: boolean) {
    savingRef.current = true;
    setSavingEvent(true);
    setEventFree(free);
    try {
      const r = await api("/api/booth/event", { method: "POST", body: JSON.stringify({ free }) });
      setEventFree(r.free === true);
      say(r.free ? "Free event ON: booths skip payment, everything prints" : "Free event OFF: guests pay again");
    } catch (e) {
      setEventFree(!free);
      say(`Couldn't change the event: ${msg(e)}`);
    } finally {
      savingRef.current = false;
      setSavingEvent(false);
    }
  }

  async function reprint(o: QueueOrder) {
    if (!window.confirm(`Print order ${o.id.slice(-6)} again? Uses ${sheetsOf(o)} sheet(s) of paper.`)) return;
    localStorage.removeItem(printedKey(o.id));
    await queue({ action: "requeue", id: o.id }).catch((e) => say(msg(e)));
  }

  if (key === null) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6 text-neutral-900">
        <h1 className="text-2xl font-extrabold">Booth admin</h1>
        <p className="text-sm text-neutral-600">Enter the station key to run the printer from this device.</p>
        <input className="w-full rounded-xl border border-neutral-300 p-3" type="password" placeholder="Station key" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
        <button
          className="w-full rounded-xl bg-violet-600 p-3 font-semibold text-white disabled:opacity-40"
          disabled={!keyDraft.trim()}
          onClick={() => {
            localStorage.setItem(KEY, keyDraft.trim());
            setKey(keyDraft.trim());
          }}
        >
          Continue
        </button>
      </main>
    );
  }

  const waiting = orders.filter((o) => o.status === "queued" && o.id !== current?.id && o.verified);
  const recent = orders.filter((o) => o.status !== "queued").sort((a, b) => (b.doneAt ?? b.claimedAt ?? b.createdAt).localeCompare(a.doneAt ?? a.claimedAt ?? a.createdAt)).slice(0, 12);
  const dot = link ? (printerLine === "Ready" ? "bg-green-500" : current ? "bg-violet-500" : "bg-amber-500") : "bg-red-500";
  const btn = "rounded-xl px-4 py-3 text-base font-semibold disabled:opacity-40";

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24 text-neutral-900">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Booth admin</h1>
        <button className={`${btn} bg-pink-600 text-white`} onClick={() => setBooth(true)}>
          Open booth
        </button>
      </header>

      <section className="space-y-3 rounded-2xl border border-neutral-200 p-4">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${dot}`} />
          <p className="font-semibold">Printer{link ? ` (${link.kind})` : ""}</p>
          <p className="text-sm text-neutral-600">{link ? printerLine : lastDevice.current ? printerLine : "Not connected"}</p>
        </div>
        {!link && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <button className={`${btn} bg-violet-600 text-white`} disabled={connecting || !can.ble} onClick={() => connect("Bluetooth")}>
                Connect Bluetooth
              </button>
              <button className={`${btn} bg-violet-600 text-white`} disabled={connecting || !can.usb} onClick={() => connect("USB")}>
                Connect USB
              </button>
            </div>
            {!can.ble && !can.usb && <p className="text-sm text-neutral-600">This browser can&apos;t reach a printer. On iPhone or iPad, open this page in the free Bluefy browser. On Android or a laptop, use Chrome.</p>}
            <p className="text-xs text-neutral-500">Close StixCut and the Liene app first: only one thing can hold the printer.</p>
          </>
        )}
        <label className="flex items-center justify-between text-sm">
          <span>
            <b>Auto-print paid orders</b>
            <br />
            <span className="text-neutral-600">{auto ? "On: orders print as soon as they are paid" : "Paused: orders wait in line"}</span>
          </span>
          <input type="checkbox" className="h-6 w-6" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>
            <b>Free event (prepaid)</b>
            <br />
            <span className="text-neutral-600">
              {eventFree == null ? "Checking…" : eventFree ? "On: no payment on any booth or guest phone. Everything prints." : "Off: guests pay on their phone"}
            </span>
          </span>
          <input type="checkbox" className="h-6 w-6" disabled={eventFree == null || savingEvent} checked={!!eventFree} onChange={(e) => saveEvent(e.target.checked)} />
        </label>
      </section>

      {current && (
        <section className="flex gap-4 rounded-2xl border-2 border-violet-500 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {current.preview && <img src={current.preview} alt="Sheet being printed, cut lines in pink" className="w-28 rounded-lg border border-neutral-200" />}
          <div className="flex-1 space-y-2">
            <p className="font-bold">
              Printing order {current.id.slice(-6)} · sheet {current.sheet} of {current.sheets}
            </p>
            <p className="text-sm text-neutral-700">{current.text}</p>
            {current.progress != null && (
              <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full bg-violet-600 transition-all" style={{ width: `${Math.round(current.progress * 100)}%` }} />
              </div>
            )}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-bold">Waiting to print ({waiting.length})</h2>
        {queueError && <p className="text-sm text-red-600">Can&apos;t reach the order list: {queueError}</p>}
        {!waiting.length && <p className="text-sm text-neutral-500">Nothing waiting.</p>}
        {waiting.map((o) => (
          <OrderRow key={o.id} o={o} />
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Recent</h2>
        {!recent.length && <p className="text-sm text-neutral-500">No orders yet.</p>}
        {recent.map((o) => (
          <OrderRow key={o.id} o={o} onReprint={o.status === "printing" && current?.id === o.id ? undefined : () => reprint(o)} />
        ))}
      </section>

      <details>
        <summary className="text-sm font-bold">Log</summary>
        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-100 p-3 text-xs">{log.join("\n") || "Nothing yet."}</pre>
        <a className="text-sm underline" href="/booth/printer">
          Printer test page
        </a>
      </details>

      {booth && (
        <div className="fixed inset-0 z-50 bg-white">
          <iframe src="/booth" title="MeSticker booth" allow="camera; microphone; fullscreen; clipboard-write" className="h-full w-full border-0" />
          <button onClick={() => setBooth(false)} className="fixed right-2 top-2 z-50 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white" aria-label="Back to admin">
            <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
            {current ? `Printing ${current.sheet}/${current.sheets}` : link ? (waiting.length ? `${waiting.length} waiting` : "Printer") : "Printer off"}
          </button>
        </div>
      )}
    </main>
  );
}

function OrderRow({ o, onReprint }: { o: QueueOrder; onReprint?: () => void }) {
  const n = sheetsOf(o);
  const tone = o.status === "failed" ? "text-red-600" : o.status === "done" ? "text-green-700" : "text-neutral-700";
  const label = o.status === "queued" ? `${o.verified ? "Paid" : "Ordered"} ${ago(o.createdAt)}` : o.status === "printing" ? "Printing" : o.status === "done" ? `Printed ${ago(o.doneAt)}` : `Failed: ${o.error ?? "unknown"}`;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {o.guides[0] ? <img src={o.guides[0]} alt="" className="h-16 w-10 rounded object-cover" /> : <div className="h-16 w-10 rounded bg-neutral-100" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          Order {o.id.slice(-6)} · {n} sheet{n > 1 ? "s" : ""}
          {!o.verified && " · no card payment"}
        </p>
        <p className={`truncate text-sm ${tone}`}>{label}</p>
      </div>
      {onReprint && (
        <button className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold" onClick={onReprint}>
          {o.status === "failed" ? "Try again" : "Reprint"}
        </button>
      )}
    </div>
  );
}
