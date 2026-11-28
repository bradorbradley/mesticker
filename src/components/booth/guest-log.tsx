"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "mesticker-station-key"; // shared with /booth/admin

type Entry = {
  orderId: string;
  event: string;
  name: string | null;
  email: string | null;
  mediaConsent: boolean;
  marketingConsent: boolean;
  photoUrl: string | null;
  stickerUrl: string | null;
  stickers: string[];
  sheets: string[];
  createdAt: string;
  emailedAt: string | null;
  print: "queued" | "printing" | "done" | "failed" | null;
};

const PRINT_LABEL: Record<string, string> = { queued: "🕒 waiting to print", printing: "🖨️ printing", done: "✅ printed", failed: "⚠️ not printed" };

/** The owner's guest log: who came, their email and consents, original photo, sheet preview, every sticker, reprint. */
export default function GuestLog() {
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [log, setLog] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get("key");
    if (fromUrl) {
      localStorage.setItem(KEY, fromUrl);
      history.replaceState(null, "", location.pathname);
    }
    setKey(fromUrl ?? localStorage.getItem(KEY));
  }, []);

  const load = useCallback(async () => {
    if (!key) return;
    setError("");
    const r = await fetch("/api/events/guests?log=1", { headers: { authorization: `Bearer ${key}` }, cache: "no-store" }).catch(() => null);
    if (!r?.ok) return setError(r?.status === 401 ? "Wrong station key." : "Couldn't load the guests.");
    setLog((await r.json()).log);
  }, [key]);
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const reprint = async (e: Entry) => {
    setNote((n) => ({ ...n, [e.orderId]: "Sending…" }));
    const r = await fetch("/api/booth/queue", { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ action: "requeue", id: e.orderId }) }).catch(() => null);
    setNote((n) => ({ ...n, [e.orderId]: r?.ok ? "In the print queue ✓" : r?.status === 404 ? "This order is no longer in the queue" : "Couldn't queue it" }));
    load();
  };

  if (key === null || (!log && error)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6">
        <h1 className="text-2xl font-bold">Guest log</h1>
        <p className="text-sm text-gray-600">Enter the station key (the same one as the print admin).</p>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Station key" className="rounded-xl border-2 px-4 py-3" />
        {error && <p className="font-semibold text-red-600">{error}</p>}
        <button
          className="rounded-xl bg-black px-4 py-3 font-bold text-white"
          onClick={() => {
            localStorage.setItem(KEY, draft.trim());
            setKey(draft.trim());
          }}
        >
          Open
        </button>
      </main>
    );
  }

  const shown = (log ?? []).filter((e) => !q || `${e.name ?? ""} ${e.email ?? ""} ${e.event}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <main className="mx-auto max-w-6xl p-4 pb-20">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Guest log</h1>
        <span className="text-sm text-gray-600">{log ? `${shown.length} sheets` : "Loading…"}</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="ml-auto rounded-xl border-2 px-3 py-2" />
        <a className="rounded-xl border-2 px-3 py-2 font-semibold" href={`/api/events/guests?format=csv&key=${encodeURIComponent(key ?? "")}`}>
          ⬇ Emails (CSV)
        </a>
        <a className="rounded-xl border-2 px-3 py-2 font-semibold" href="/booth/admin">
          🖨️ Printer
        </a>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {shown.map((e) => (
          <article key={e.orderId} className="flex flex-col gap-3 rounded-2xl border-2 bg-white p-3 md:flex-row">
            <div className="flex gap-3">
              {e.sheets[0] ? (
                <button onClick={() => setZoom(e.sheets[0])} title="Sheet preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.sheets[0]} alt="Sheet" loading="lazy" className="h-56 w-auto rounded-lg border bg-white" style={{ aspectRatio: "3.9 / 6.7" }} />
                </button>
              ) : (
                <div className="flex h-56 items-center justify-center rounded-lg border bg-gray-50 px-3 text-sm text-gray-500" style={{ aspectRatio: "3.9 / 6.7" }}>
                  no sheet saved
                </div>
              )}
              {e.photoUrl && (
                <button onClick={() => setZoom(e.photoUrl)} title="Original photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.photoUrl} alt="Original" loading="lazy" className="h-56 w-40 rounded-lg object-cover" />
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-xl font-bold">{e.name ?? "No name"}</h2>
                {e.email ? <a className="text-blue-700 underline" href={`mailto:${e.email}`}>{e.email}</a> : <span className="text-gray-500">not signed up</span>}
              </div>
              <p className="text-sm text-gray-600">
                {e.event} · {new Date(e.createdAt).toLocaleString()} · {e.mediaConsent ? "✅ can feature" : "🚫 don't feature"} · {e.marketingConsent ? "✅ emails ok" : "🚫 no marketing"} · {e.emailedAt ? "📧 emailed" : "📧 not emailed yet"}
                {e.print ? ` · ${PRINT_LABEL[e.print]}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[...new Set([e.stickerUrl, ...e.stickers].filter((x): x is string => !!x))].map((src) => (
                  <button key={src} onClick={() => setZoom(src)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" loading="lazy" className="h-20 w-20 rounded-md bg-gray-50 object-contain" />
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="rounded-xl bg-[#a3161c] px-4 py-2 font-bold text-white" onClick={() => reprint(e)}>
                  🖨️ Print this sheet
                </button>
                <a className="rounded-xl border-2 px-4 py-2 font-semibold" href={`/booth/mine/${e.orderId}`} target="_blank">
                  Guest&apos;s download page
                </a>
                {note[e.orderId] && <span className="text-sm font-semibold">{note[e.orderId]}</span>}
              </div>
            </div>
          </article>
        ))}
        {log && !shown.length && <p className="py-10 text-center text-gray-500">No guests yet.</p>}
      </div>

      {zoom && (
        <button className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-xl bg-white" />
        </button>
      )}
    </main>
  );
}
