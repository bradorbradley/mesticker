"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { bundlePrice, priceLabel } from "@/lib/booth-config";
import { dataUrlToFile, localImage, toDataUrl } from "@/lib/street-client";

type Status = { id: string; code: string; payment: "none" | "paid" | "cash" | "free"; printed: boolean; mainUrl: string | null };

/** The guest's phone after paying: their code for the seller, then "ready!" once it's printed. */
export default function StreetDone({ id }: { id: string }) {
  const [s, setS] = useState<Status | null>(null);
  const [missing, setMissing] = useState(false);
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    if (!id) return setMissing(true);
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/street/order?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (r.status === 404) return alive && setMissing(true);
        const d = await r.json();
        if (alive && r.ok) setS(d);
      } catch {}
      if (alive) setWaited((w) => w + 1);
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  const save = async () => {
    if (!s?.mainUrl) return;
    try {
      const file = dataUrlToFile(await toDataUrl(s.mainUrl), "mesticker.png");
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else window.open(localImage(s.mainUrl), "_blank");
    } catch {}
  };

  const price = priceLabel(bundlePrice(1));

  return (
    <div className="booth fixed inset-0 z-40 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-6 py-10 text-center" style={{ gap: 18 }}>
        {missing ? (
          <p className="t-lead">We couldn&apos;t find that order. Show this screen to the seller.</p>
        ) : !s ? (
          <motion.span className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            ✨
          </motion.span>
        ) : (
          <>
            {s.printed ? (
              <h1 className="t-h2 !text-[38px]">
                Your sheet is <span className="pop">ready!</span> 🎉
              </h1>
            ) : s.payment === "none" ? (
              <h1 className="t-h2 !text-[32px]">Checking your payment…</h1>
            ) : s.payment === "cash" ? (
              <h1 className="t-h2 !text-[32px]">
                Pay the seller <span className="pop">{price}</span> in cash
              </h1>
            ) : (
              <h1 className="t-h2 !text-[34px]">
                You&apos;re all set! <span className="pop">Printing now.</span>
              </h1>
            )}
            <div className="card px-10 py-6">
              <div className="t-body">Your code</div>
              <div className="font-fun font-bold" style={{ fontSize: 96, lineHeight: 1 }}>
                {s.code}
              </div>
            </div>
            <p className="t-lead">{s.printed ? "Grab it from the seller and peel away." : "Show this code to the seller. Your stickers take about 3 minutes."}</p>
            {s.payment === "none" && waited > 10 && (
              <a className="btn btn-soft" href={`/street?o=${s.id}`}>
                Didn&apos;t go through? Back to my sticker
              </a>
            )}
            {s.mainUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={localImage(s.mainUrl)} alt="Your sticker" className="die-cut w-40" />
                <button className="btn btn-soft" onClick={save}>
                  📲 Save my sticker to my phone
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
