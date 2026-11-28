"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Files = { ready: boolean; sheet: string | null; hero: string | null; stickers: string[]; event?: string | null };

/** One image as a transparent PNG file (Photos takes PNGs everywhere; WebP sometimes lands in Files). */
async function asPng(src: string, i: number): Promise<File> {
  const blob = await (await fetch(src)).blob();
  try {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    const png = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (png) return new File([png], `mesticker-${i + 1}.png`, { type: "image/png" });
  } catch {
    /* keep the original */
  }
  return new File([blob], `mesticker-${i + 1}.${blob.type.includes("png") ? "png" : "webp"}`, { type: blob.type || "image/png" });
}

/** Save every sticker as its own photo: iPhone shows "Save N Images", Android "Save to Photos". */
export async function saveImages(srcs: string[]): Promise<string> {
  const files = await Promise.all(srcs.map(asPng));
  if (navigator.canShare?.({ files })) {
    await navigator.share({ files });
    return "Saved! 🎉";
  }
  for (const f of files) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
  }
  return "Saved to your downloads!";
}

export default function MyOrderStickers({ id }: { id: string }) {
  const [files, setFiles] = useState<Files | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/booth/order-files?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const d = (await r.json()) as Files;
        if (!alive) return;
        if (d.ready) setFiles(d);
        else setTimeout(load, 3000); // the booth is still sending them
      } catch {
        if (alive) setTimeout(load, 4000);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  const all = files ? Array.from(new Set(files.stickers)) : [];
  return (
    <div className="booth theme-carol fixed inset-0 z-40 flex flex-col items-center overflow-auto px-5 pb-10 pt-8 text-center" style={{ gap: 16 }}>
      <div className="font-fun text-3xl">MeSticker</div>
      {!files ? (
        <>
          <motion.div style={{ fontSize: 56 }} animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
            🎁
          </motion.div>
          <p className="t-lead">Wrapping up your stickers…</p>
        </>
      ) : (
        <>
          <h1 className="t-h2 !text-[34px]">
            Your <span className="pop">stickers!</span>
          </h1>
          <button
            className="btn btn-lg btn-main w-full max-w-sm justify-center"
            onClick={async () => {
              setStatus("Getting them ready…");
              setStatus(await saveImages(all).catch(() => "Tip: press and hold any sticker to save it."));
            }}
          >
            📲 Save all {all.length} to Photos
          </button>
          {status && <p className="t-body">{status}</p>}
          {files.event && (
            <a className="btn btn-soft" href={`/booth/album/${files.event}?o=${encodeURIComponent(id)}`}>
              🎓 Class photo &amp; gallery
            </a>
          )}
          {files.sheet && (
            <button className="btn btn-soft" onClick={async () => setStatus(await saveImages([files.sheet!]).catch(() => "Press and hold the sheet to save it."))}>
              Save the whole sheet too
            </button>
          )}
          {files.sheet && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={files.sheet} alt="Your sticker sheet" className="w-[min(80vw,360px)] rounded-xl bg-white p-2 shadow-lg" />
          )}
          <div className="grid w-full max-w-md grid-cols-3 gap-3">
            {files.stickers.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s} src={s} alt="Sticker" className="w-full" />
            ))}
          </div>
          <p className="t-body">Or press and hold any sticker to save it.</p>
        </>
      )}
    </div>
  );
}
