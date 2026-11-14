"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { sounds } from "@/lib/booth-sounds";
import type { QueueOrder } from "@/lib/booth-queue";

const KEY_STORE = "mesticker-station-key";
const ago = (t: number) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
};

/**
 * Print station (staff phone running the Liene app). Shows the QR guests scan
 * to start on their own phone, and the queue of sheets to print: open an
 * order's Liene kit, upload the images one by one, print, tap Printed.
 */
export default function PrintStation() {
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [orders, setOrders] = useState<QueueOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestQr, setGuestQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get("key");
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY_STORE);
    } catch {}
    const k = fromUrl || stored;
    if (k) setKey(k);
    if (fromUrl) {
      try {
        localStorage.setItem(KEY_STORE, fromUrl);
      } catch {}
      history.replaceState(null, "", "/booth/station"); // keep the key out of screenshots
    }
    QRCode.toDataURL(`${location.origin}/booth`, { width: 700, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } }).then(setGuestQr);
  }, []);

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const r = await fetch(`/api/booth/queue?key=${encodeURIComponent(key)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Queue unavailable");
      const list = d.orders as QueueOrder[];
      if (seen.current && list.some((o) => !seen.current!.has(o.id))) sounds.success(); // new order chime
      seen.current = new Set(list.map((o) => o.id));
      setOrders(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Queue unavailable");
    }
  }, [key]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  const done = async (id: string) => {
    setOrders((o) => o?.filter((x) => x.id !== id) ?? o);
    await fetch(`/api/booth/queue?key=${encodeURIComponent(key ?? "")}&id=${id}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  if (!key || error === "Wrong station key") {
    return (
      <div className="booth fixed inset-0 z-40 flex flex-col items-center justify-center p-6 text-center" style={{ gap: 14 }}>
        <div className="font-fun text-3xl font-bold">🖨️ Print station</div>
        {error && <div className="t-body text-[var(--pink)]">That key didn&apos;t work.</div>}
        <form
          className="flex w-full max-w-sm"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            try {
              localStorage.setItem(KEY_STORE, draft);
            } catch {}
            setError(null);
            setKey(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Station key"
            className="t-body min-w-0 flex-1 rounded-full border-2 border-[#e4dcff] bg-white px-4 py-2 outline-none"
            style={{ userSelect: "text" }}
          />
          <button className="btn btn-main">Open</button>
        </form>
      </div>
    );
  }

  return (
    <div className="booth fixed inset-0 z-40 overflow-y-auto">
      <div className="mx-auto flex max-w-xl flex-col px-4 pb-12 pt-5" style={{ gap: 14 }}>
        <div className="flex items-center justify-between">
          <div className="font-fun text-2xl font-bold">🖨️ Print queue</div>
          <button className="btn btn-soft" onClick={() => setShowQr(true)}>
            📱 Guest QR
          </button>
        </div>
        {error && <div className="t-body text-[var(--pink)]">⚠️ {error}. Retrying…</div>}

        {orders === null ? (
          <div className="card t-body p-6 text-center">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="card flex flex-col items-center p-6 text-center" style={{ gap: 10 }}>
            <div className="t-h3">Nothing to print yet</div>
            <div className="t-body">Guests scan the QR, make their sticker sheet on their own phone, pay, and it shows up here (with a chime).</div>
            <button className="btn btn-main" onClick={() => setShowQr(true)}>
              Show the guest QR
            </button>
          </div>
        ) : (
          orders.map((o, i) => (
            <div key={o.id} className="card flex items-center gap-3 p-3">
              {o.guide ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.guide} alt="" className="h-28 w-auto shrink-0 rounded-md border border-[#eee8ff]" style={{ aspectRatio: "3.9 / 6.7" }} />
              ) : (
                <div className="h-28 w-16 shrink-0 rounded-md bg-[var(--lav)]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-fun text-3xl font-bold">#{o.code}</div>
                <div className="t-body">
                  {o.productName} · {ago(o.created)}
                </div>
                <div className={`t-body font-semibold ${o.paid ? "text-[#15803d]" : "text-[#b45309]"}`}>{o.paid ? "✓ Paid" : "Free / not paid"}</div>
                {i === 0 && <div className="t-body text-[var(--purple)]">Next up</div>}
              </div>
              <div className="flex shrink-0 flex-col" style={{ gap: 8 }}>
                <a className="btn btn-main text-center" href={o.kitUrl} target="_blank" rel="noreferrer">
                  Open kit
                </a>
                <button className="btn btn-soft" onClick={() => done(o.id)}>
                  ✓ Printed
                </button>
              </div>
            </div>
          ))
        )}

        <div className="t-body text-center opacity-70">Open kit → save the images → in the Liene app add each one, Remove background, arrange, Print.</div>
      </div>

      {showQr && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6 text-center" style={{ gap: 16 }} onClick={() => setShowQr(false)}>
          <div className="font-fun text-4xl font-bold">
            Turn yourself into <span className="pop">stickers!</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {guestQr && <img src={guestQr} alt="Scan to start" className="w-[min(80vw,60vh)]" />}
          <div className="t-lead">📸 Scan with your phone camera</div>
          <div className="t-body opacity-60">Tap anywhere to close</div>
        </div>
      )}
    </div>
  );
}
