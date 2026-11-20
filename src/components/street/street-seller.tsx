"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { bundlePrice, priceLabel } from "@/lib/booth-config";
import { sounds } from "@/lib/booth-sounds";
import { STREET_POSES, buildStreetSheet, dataUrlToFile, localImage, makeIdeas, makePoses, toDataUrl, uploadImage } from "@/lib/street-client";

/**
 * The seller's phone in street mode (the one paired with the Liene printer).
 * New paid orders appear here with a chime; each one's sheet is built right
 * on this phone, and Print hands the finished sheet to the share sheet:
 * Save Image, then Liene app → Upload → Print.
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
                      <button className="btn btn-soft !px-3 !py-1" onClick={() => api("POST", { id: o.id, action: "unprinted" })}>
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

/** Only one heal per order per page load, however often the list refreshes. */
const healing = new Set<string>();

function OrderCard({ order, api }: { order: Order; api: (m: "GET" | "POST", b?: object) => Promise<unknown> }) {
  const [sheet, setSheet] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [healed, setHealed] = useState<Record<number, string | false>>({});
  const [healDone, setHealDone] = useState(false);
  const [shared, setShared] = useState(false);
  const [nonce, setNonce] = useState(0);
  const built = useRef<string | null>(null);

  const poses = order.poses.map((p, i) => p ?? healed[i] ?? null);
  const missing = order.poses.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);

  // Make any poses the guest's phone didn't finish (it stops when they go to pay).
  useEffect(() => {
    if (healing.has(order.id)) return;
    if (!missing.length) return setHealDone(true);
    if (!order.photoUrl) return setHealDone(true);
    healing.add(order.id);
    (async () => {
      try {
        setNote(`Making ${missing.length} more pose${missing.length === 1 ? "" : "s"}…`);
        const photo = await toDataUrl(order.photoUrl!);
        const ideas = order.ideas.length ? order.ideas : await makeIdeas(photo);
        await makePoses(photo, ideas, missing, async (i, img) => {
          if (!img) return setHealed((h) => ({ ...h, [i]: false }));
          try {
            const url = await uploadImage(img);
            setHealed((h) => ({ ...h, [i]: url }));
            await api("POST", { id: order.id, action: "stickers", poses: Array.from({ length: STREET_POSES }, (_, k) => (k === i ? url : null)) });
          } catch {
            setHealed((h) => ({ ...h, [i]: img }));
          }
        });
      } catch {
        // print with what we have; missing poses repeat the main sticker
      } finally {
        setNote(null);
        setHealDone(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  // Build the sheet once every pose is in (or given up on).
  const sig = `${nonce}|${order.mainUrl}|${poses.map((p) => (p ? p.slice(-24) : "-")).join(",")}`;
  const allIn = poses.every((p) => p) || healDone;
  useEffect(() => {
    if (!order.mainUrl || !allIn || built.current === sig) return;
    built.current = sig;
    setNote("Building the sheet…");
    buildStreetSheet(order.mainUrl, poses.map((p) => (p ? p : null)))
      .then((png) => {
        setSheet(png);
        setFile(dataUrlToFile(png, `mesticker-${order.code}.png`));
        setNote(null);
      })
      .catch(() => {
        built.current = null;
        setNote("Couldn't build the sheet. Tap Rebuild.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, allIn]);

  const print = async () => {
    if (!file || !sheet) return;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }); // iOS: Save Image · Android: Save / Liene if it's listed
      } else {
        const a = document.createElement("a");
        a.href = sheet;
        a.download = file.name;
        a.click();
      }
      setShared(true);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setNote("Couldn't open the share sheet. Press and hold the sheet, then Save.");
    }
  };

  const ready = poses.filter(Boolean).length;
  const pay =
    order.payment === "paid" ? { t: "Paid", c: "#15803d" } : order.payment === "cash" ? { t: `Cash: collect ${priceLabel(bundlePrice(1))}`, c: "#b45309" } : { t: "Free (test)", c: "#6b7280" };

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

      {sheet ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sheet} alt={`Sheet ${order.code}`} className="mx-auto w-[62%] rounded-lg border border-[#eee8ff] bg-[repeating-conic-gradient(#f3f0fa_0_25%,#fff_0_50%)] bg-[length:16px_16px]" />
      ) : (
        <div className="t-body py-6 text-center">{note ?? "Waiting for the stickers…"}</div>
      )}

      <button className="btn btn-lg btn-main" disabled={!file} onClick={print}>
        🖨️ Print
      </button>
      {shared && (
        <ol className="t-body list-decimal pl-5" style={{ lineHeight: 1.5 }}>
          <li>
            Tap <b>Save Image</b> (it goes to Photos).
          </li>
          <li>
            Open <b>Liene</b> → <b>Upload</b> → pick the newest photo.
          </li>
          <li>Keep the stickers as they are (it&apos;s already cut-ready), check the preview, then <b>Print</b>.</li>
        </ol>
      )}
      <div className="flex gap-2">
        <button className="btn btn-soft flex-1" onClick={() => api("POST", { id: order.id, action: "printed" })}>
          ✓ Printed
        </button>
        <button
          className="btn btn-soft"
          onClick={() => {
            setSheet(null);
            setFile(null);
            setHealDone(true);
            setNonce((n) => n + 1);
          }}
        >
          Rebuild
        </button>
      </div>
      {note && sheet && <div className="t-body">{note}</div>}
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
