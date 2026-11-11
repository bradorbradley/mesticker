"use client";

import { useState } from "react";

export interface Kit {
  guide: string | null;
  items: { n: number; url: string; w: number; h: number }[];
}

/**
 * Staff phone: the numbered sheet guide and the 8 images, ready to save to
 * Photos and then add one at a time in the Liene app (each needs its own
 * "Remove background" tap, which multi-select doesn't offer).
 */
export default function LieneKit({ kit }: { kit: Kit | null }) {
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [placed, setPlaced] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<string | null>(null);

  if (!kit) {
    return (
      <div className="booth fixed inset-0 z-40 flex items-center justify-center p-8 text-center">
        <div className="t-h3">This kit link has expired. Open it again from the booth.</div>
      </div>
    );
  }

  const toFile = async (url: string, n: number) => {
    const blob = await (await fetch(url)).blob();
    return new File([blob], `mesticker-${n}.png`, { type: blob.type || "image/png" });
  };
  const share = async (idx: number[]) => {
    try {
      const files = await Promise.all(idx.map((i) => toFile(kit.items[i].url, kit.items[i].n)));
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files }); // iOS: "Save N Images"
      } else {
        files.forEach((f) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(f);
          a.download = f.name;
          a.click();
        });
      }
      setSaved((s) => new Set([...s, ...idx]));
      setStatus(null);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setStatus("Couldn't save. Press and hold an image, then tap Save.");
    }
  };
  const toggle = (i: number) =>
    setPlaced((p) => {
      const next = new Set(p);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="booth fixed inset-0 z-40 overflow-y-auto">
      <div className="mx-auto flex max-w-md flex-col px-4 pb-12 pt-6" style={{ gap: 16 }}>
        <div className="font-fun text-2xl font-bold">MeSticker · Liene kit</div>

        <button className="btn btn-lg btn-main" onClick={() => share(kit.items.map((_, i) => i))}>
          📥 Save all {kit.items.length} to Photos
        </button>
        {status && <div className="t-body text-[var(--pink)]">{status}</div>}

        <div className="card p-4">
          <div className="t-h3 mb-2">Steps</div>
          <ol className="t-body list-decimal pl-5" style={{ lineHeight: 1.6 }}>
            <li>Liene app → <b>Sticker</b> → new <b>4×7</b> canvas.</li>
            <li>For <b>1 → {kit.items.length}</b>: add the image → <b>Remove background</b> → resize → drag to its numbered spot. Tick it below.</li>
            <li>Leave a small gap between stickers for the cutter.</li>
            <li><b>Print</b> (≈ 2 min to print + cut).</li>
          </ol>
        </div>

        {kit.guide && (
          <div className="card p-3">
            <div className="t-h3 mb-2">Where each goes</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={kit.guide} alt="Numbered sheet guide" className="mx-auto w-[70%] rounded-lg border border-[#eee8ff]" />
          </div>
        )}

        <div className="flex flex-col" style={{ gap: 10 }}>
          {kit.items.map((it, i) => (
            <div key={i} className={`card flex items-center gap-3 p-3 ${placed.has(i) ? "opacity-50" : ""}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] font-fun text-lg font-bold text-white">{it.n}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.url} alt={`Sticker ${it.n}`} className="h-20 w-20 shrink-0 rounded-lg object-contain" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {it.w}&quot; × {it.h}&quot;
                </div>
                <button className="t-body text-[var(--purple)] underline" onClick={() => share([i])}>
                  {saved.has(i) ? "Saved ✓ · save again" : "Save this one"}
                </button>
              </div>
              <button className={`btn ${placed.has(i) ? "btn-main" : "btn-soft"} shrink-0`} onClick={() => toggle(i)}>
                {placed.has(i) ? "✓ Placed" : "Placed?"}
              </button>
            </div>
          ))}
        </div>
        {placed.size === kit.items.length && <div className="t-h3 text-center">All placed! Hit Print 🖨️</div>}
      </div>
    </div>
  );
}
