"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/** Only show images we host, so this page can't be used to frame anything else. */
function safe(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname.endsWith(".public.blob.vercel-storage.com") || u.hostname.endsWith("mesticker.fun"));
  } catch {
    return false;
  }
}

/**
 * The guest's phone: their sticker, one tap to save it to Photos or send it
 * to a friend (iOS/Android share sheet → Messages, AirDrop, Instagram…).
 */
export default function GetSticker({ url }: { url: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const ok = safe(url);

  const fileFromUrl = async () => {
    const blob = await (await fetch(url)).blob();
    return new File([blob], "mesticker.png", { type: blob.type || "image/png" });
  };

  const save = async () => {
    try {
      const file = await fileFromUrl();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }); // iOS shows "Save Image"
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = "mesticker.png";
      a.click();
      setStatus("Saved! Check your downloads.");
    } catch {
      setStatus("Tip: press and hold the sticker, then tap Save.");
    }
  };

  const share = async () => {
    try {
      const file = await fileFromUrl();
      const data = { files: [file], title: "My MeSticker", text: "I turned myself into a sticker at the MeSticker booth! ✨" };
      if (navigator.canShare?.(data)) await navigator.share(data);
      else if (navigator.share) await navigator.share({ title: data.title, text: data.text, url: location.href });
      else setStatus("Copy this page's link to share it.");
    } catch {
      /* closed the share sheet */
    }
  };

  return (
    <div className="booth fixed inset-0 z-40 flex flex-col items-center overflow-auto px-6 pb-10 pt-8 text-center" style={{ gap: 18 }}>
      <div className="font-fun text-2xl font-bold">
        Me<span className="pop">Sticker</span>
      </div>
      {ok ? (
        <>
          <h1 className="t-h2 !text-[34px]">
            Here&apos;s your <span className="pop">sticker!</span>
          </h1>
          <motion.img
            src={url}
            alt="Your sticker"
            className="die-cut w-[min(80vw,420px)]"
            initial={{ scale: 0.4, rotate: -15, opacity: 0 }}
            animate={{ scale: 1, rotate: -3, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 12 }}
          />
          <div className="flex w-full max-w-sm flex-col" style={{ gap: 12 }}>
            <button className="btn btn-lg btn-main" onClick={save}>
              📲 Save to my phone
            </button>
            <button className="btn btn-soft" onClick={share}>
              💬 Text it to a friend
            </button>
          </div>
          {status && <p className="t-body">{status}</p>}
          <p className="t-body">Or press and hold the sticker and tap “Save”.</p>
        </>
      ) : (
        <p className="t-lead mt-20">This sticker link isn&apos;t valid. Scan the code on the booth again.</p>
      )}
      <a href="https://mesticker.fun" className="t-body underline">
        Make more stickers at mesticker.fun
      </a>
    </div>
  );
}
