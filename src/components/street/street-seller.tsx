"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { bundlePrice, priceLabel } from "@/lib/booth-config";
import { sounds } from "@/lib/booth-sounds";
import { STREET_POSES, dataUrlToFile, healPoses, localImage, sendToStation, stickerFiles } from "@/lib/street-client";

/**
 * The seller's phone in street mode. The print station laptop (in the
 * backpack, on this phone's hotspot) prints and cuts every order; this page
 * shows each one with a chime, takes cash ("Got the cash"), sends an order to
 * the laptop itself if the guest's phone didn't, and can save the stickers to
 * Photos as a no-laptop fallback.
 */

type Payment = "none" | "paid" | "cash" | "free";
interface Order {
  id: string;
  code: string;
  payment: Payment;
  photoUrl: string | null;
  mainUrl: string | null;
  poses: (string | null)[];
  ideas: string[];
  printed: boolean;
  collected: boolean;
  queuedAt: string | null;
  queue: { status: "queued" | "printing" | "done" | "failed"; stage: "preparing" | "printing" | null; verified: boolean; ahead: number } | null;
  createdAt: string;
  paidAt: string | null;
}

const KEY_STORE = "mesticker-street-key";

export default function StreetSeller() {
  const [key, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "qr">("orders");
  const [live, setLive] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    try {
      setKey(localStorage.getItem(KEY_STORE));
    } catch {}
  }, []);

  const api = useCallback(
    async (method: "GET" | "POST", body?: object) => {
      const r = await fetch("/api/street/orders", {
        method,
        cache: "no-store",
        headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(d.error || String(r.status)), { status: r.status });
      return d;
    },
    [key]
  );

  // poll for orders
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const poll = async () => {
      try {
        const d = await api("GET");
        if (!alive) return;
        const list = d.orders as Order[];
        const ready = list.filter((o) => o.payment !== "none" && !o.printed);
        if (seen.current) {
          const fresh = ready.filter((o) => !seen.current!.has(o.id));
          if (fresh.length) {
            sounds.success();
            navigator.vibrate?.([200, 100, 200]);
          }
        }
        seen.current = new Set([...(seen.current ?? []), ...ready.map((o) => o.id)]);
        setOrders(list);
        setError(null);
      } catch (e) {
        if (!alive) return;
        if ((e as { status?: number }).status === 401) {
          try {
            localStorage.removeItem(KEY_STORE);
          } catch {}
          setKey(null);
          setError("That key didn't work.");
        } else setError("Can't reach the server. Check your signal.");
      }
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [key, api]);

  // keep the screen on while selling
  const goLive = async () => {
    sounds.success(); // unlocks audio for the chimes (needs a tap)
    setLive(true);
    try {
      wake.current = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {}
  };
  useEffect(() => {
    const again = () => {
      if (live && document.visibilityState === "visible") goLive();
    };
    document.addEventListener("visibilitychange", again);
    return () => document.removeEventListener("visibilitychange", again);
  });

  if (!key) {
    return (
      <div className="booth fixed inset-0 z-40 overflow-y-auto">
        <form
          className="mx-auto flex max-w-sm flex-col px-6 pt-16"
          style={{ gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            const k = keyInput.trim();
            if (!k) return;
            try {
              localStorage.setItem(KEY_STORE, k);
            } catch {}
            setKey(k);
          }}
        >
          <div className="font-fun text-2xl font-bold">MeSticker · Street printer</div>
          <p className="t-body">Enter your street key (STREET_KEY in Vercel). This phone remembers it.</p>
          <input className="rounded-xl border border-[#ddd5ff] bg-white px-4 py-3 text-lg" type="password" autoComplete="off" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Street key" />
          <button className="btn btn-lg btn-main" type="submit">
            Open
          </button>
          {error && <p className="t-body text-[var(--pink)]">{error}</p>}
        </form>
      </div>
    );
  }

  const toPrint = (orders ?? []).filter((o) => o.payment !== "none" && !o.printed).sort((a, b) => (a.paidAt ?? a.createdAt).localeCompare(b.paidAt ?? b.createdAt));
  const making = (orders ?? []).filter((o) => o.payment === "none" && Date.now() - Date.parse(o.createdAt) < 20 * 60_000);
  const printed = (orders ?? []).filter((o) => o.printed).slice(0, 8);

  return (
    <div className="booth fixed inset-0 z-40 overflow-y-auto">
      <div className="mx-auto flex max-w-md flex-col px-4 pb-16 pt-4" style={{ gap: 14 }}>
        <div className="flex items-center justify-between">
          <div className="font-fun text-xl font-bold">
            Me<span className="pop">Sticker</span> street
          </div>
          <div className="flex gap-2">
            <button className={`btn ${tab === "orders" ? "btn-main" : "btn-soft"} !px-4 !py-2`} onClick={() => setTab("orders")}>
              Orders{toPrint.length ? ` (${toPrint.length})` : ""}
            </button>
            <button className={`btn ${tab === "qr" ? "btn-main" : "btn-soft"} !px-4 !py-2`} onClick={() => setTab("qr")}>
              QR
            </button>
          </div>
        </div>

        {!live && (
          <button className="btn btn-lg btn-main" onClick={goLive}>
            🔔 Start selling (chime on + screen stays on)
          </button>
        )}
        {error && <div className="card p-3 t-body text-[var(--pink)]">{error}</div>}

        {tab === "qr" ? (
          <QrPanel />
        ) : (
          <>
            {making.length > 0 && <div className="t-body">✨ {making.length} making a sticker right now</div>}
            {orders && !toPrint.length && <div className="card p-6 text-center t-lead">No orders waiting. Show your QR!</div>}
            {toPrint.map((o) => (
              <OrderCard key={o.id} order={o} api={api} />
            ))}
            {printed.length > 0 && (
              <details className="card p-3">
                <summary className="t-h3">Printed today ({printed.length})</summary>
                <div className="mt-2 flex flex-col" style={{ gap: 8 }}>
                  {printed.map((o) => (
                    <div key={o.id} className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {o.mainUrl && <img src={localImage(o.mainUrl)} alt="" className="h-12 w-12 object-contain" />}
                      <span className="font-fun text-xl font-bold">{o.code}</span>
                      <span className="t-body flex-1">{o.payment}</span>
                      <button className="btn btn-soft !px-3 !py-1" onClick={() => api("POST", { id: o.id, action: o.queuedAt ? "reprint" : "unprinted" })}>
                        Print again
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
        <button
          className="t-body mt-6 underline opacity-60"
          onClick={() => {
            try {
              localStorage.removeItem(KEY_STORE);
            } catch {}
            setKey(null);
          }}
        >
          Sign out of this phone
        </button>
      </div>
    </div>
  );
}

// ================================================================ one order

/** Only one backup send per order per page load, however often the list refreshes. */
const sending = new Set<string>();
/** The guest's phone sends the order itself; the seller's steps in after this long. */
const BACKUP_AFTER_MS = 45_000;

function OrderCard({ order, api }: { order: Order; api: (m: "GET" | "POST", b?: object) => Promise<unknown> }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  // re-check the backup timer every few seconds
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const send = useCallback(async () => {
    if (!order.mainUrl || sending.has(order.id)) return;
    sending.add(order.id);
    setBusy(true);
    const poses = [...order.poses];
    try {
      if (poses.some((p) => !p) && order.photoUrl) {
        setNote("Making the missing poses…");
        await healPoses(
          order,
          (i, url) => api("POST", { id: order.id, action: "stickers", poses: Array.from({ length: STREET_POSES }, (_, k) => (k === i ? url : null)) }),
          (i, url) => {
            if (url) poses[i] = url;
          }
        ).catch(() => {});
      }
      setNote("Sending to the printer…");
      await sendToStation(order.id, order.mainUrl, poses);
      setNote(null);
    } catch (e) {
      sending.delete(order.id);
      setNote(`Couldn't send it: ${e instanceof Error ? e.message : "error"}. Tap Send to printer.`);
    } finally {
      setBusy(false);
    }
  }, [order, api]);

  const paidFor = Date.now() - Date.parse(order.paidAt ?? order.createdAt);
  useEffect(() => {
    if (!order.queuedAt && order.mainUrl && paidFor > BACKUP_AFTER_MS) send();
  }, [order.queuedAt, order.mainUrl, paidFor, send]);

  const saveStickers = async () => {
    if (!order.mainUrl) return;
    try {
      setNote("Getting the stickers ready…");
      const files = await stickerFiles(order.mainUrl, order.poses, order.code);
      setNote(null);
      if (navigator.canShare?.({ files })) await navigator.share({ files });
      else setNote("This phone can't share files. Use the laptop.");
    } catch (e) {
      setNote((e as Error)?.name === "AbortError" ? null : "Couldn't open the share sheet.");
    }
  };

  const q = order.queue;
  const awaitingCash = order.payment === "cash" && !order.collected;
  const state = !order.queuedAt
    ? note ?? "Waiting for the guest's phone to send it…"
    : !q
      ? "Sent to the printer"
      : q.status === "failed"
        ? "The printer reported a problem"
        : q.status === "printing"
          ? q.stage === "printing"
            ? "Printing and cutting"
            : "Laptop is laying it out"
          : awaitingCash
            ? "Waiting for your cash tap"
            : !q.verified
              ? "Queued (free test: laptop needs --include-unverified)"
              : q.ahead > 0
                ? `In line, ${q.ahead} ahead`
                : "Up next on the laptop";
  const ready = order.poses.filter(Boolean).length;
  const pay =
    order.payment === "paid"
      ? { t: "Paid", c: "#15803d" }
      : order.payment === "cash"
        ? { t: order.collected ? "Cash collected" : `Cash: collect ${priceLabel(bundlePrice(1))}`, c: order.collected ? "#15803d" : "#b45309" }
        : { t: "Free (test)", c: "#6b7280" };

  return (
    <div className="card flex flex-col p-4" style={{ gap: 12 }}>
      <div className="flex items-center gap-3">
        <span className="font-fun font-bold" style={{ fontSize: 44, lineHeight: 1 }}>
          {order.code}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {order.mainUrl && <img src={localImage(order.mainUrl)} alt="" className="h-14 w-14 object-contain" />}
        <div className="flex-1 text-right">
          <div className="font-semibold" style={{ color: pay.c }}>
            {pay.t}
          </div>
          <div className="t-body">
            {ready}/{STREET_POSES} poses
          </div>
        </div>
      </div>

      <div className="t-lead text-center">{state}</div>

      {awaitingCash && (
        <button className="btn btn-lg btn-main" onClick={() => api("POST", { id: order.id, action: "collected" })}>
          💵 Got the cash: print it
        </button>
      )}
      {!order.queuedAt && (
        <button className="btn btn-soft" disabled={busy} onClick={send}>
          {busy ? "Sending…" : "🖨️ Send to printer now"}
        </button>
      )}
      {note && order.queuedAt && <div className="t-body">{note}</div>}
      <div className="flex gap-2">
        <button className="btn btn-soft flex-1" onClick={() => api("POST", { id: order.id, action: "printed" })}>
          ✓ Printed
        </button>
        {order.queuedAt && (q?.status === "failed" || q?.status === "done") && (
          <button className="btn btn-soft flex-1" onClick={() => api("POST", { id: order.id, action: "reprint" })}>
            Print again
          </button>
        )}
      </div>
      <details>
        <summary className="t-body opacity-70">No laptop? Save the stickers</summary>
        <div className="mt-2 flex flex-col" style={{ gap: 8 }}>
          <button className="btn btn-soft" onClick={saveStickers}>
            📲 Save the {Math.min(8, ready + 1)} stickers to Photos
          </button>
          <p className="t-body">Then Liene → Upload → pick them all → Print. Each one is its own image, so the printer cuts each.</p>
        </div>
      </details>
    </div>
  );
}

// ================================================================ QR

function QrPanel() {
  const [qr, setQr] = useState<string | null>(null);
  const url = typeof location !== "undefined" ? `${location.origin}/street` : "";
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { width: 900, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } }).then(setQr);
  }, [url]);
  const save = async () => {
    if (!qr) return;
    const file = dataUrlToFile(qr, "mesticker-street-qr.png");
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    } catch {}
  };
  return (
    <div className="card flex flex-col items-center p-5 text-center" style={{ gap: 12 }}>
      <div className="t-h2 !text-[30px]">
        Scan me for <span className="pop">stickers!</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt="QR code" className="w-full max-w-[340px] rounded-xl" />}
      <div className="t-lead">
        Selfie → 12 stickers of you · {priceLabel(bundlePrice(1))}
      </div>
      <div className="t-body break-all opacity-70">{url}</div>
      <button className="btn btn-soft" onClick={save}>
        Save QR to Photos
      </button>
    </div>
  );
}
