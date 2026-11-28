"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SHEET_DESIGNS, STICKERS_PER_SHEET, bundlePrice, priceLabel, type SheetKind } from "@/lib/booth-config";
import type { LaptopState, Pair } from "@/lib/booth-pair";
import { getPartyEvent } from "@/lib/party-events";
import GuestSignup, { claimOrder, loadSavedGuest, saveGuest, type SavedGuest } from "./guest-signup";

/**
 * The guest's phone, paired with the booth laptop through the QR on its camera
 * screen. 1) take a selfie or pick a photo → it goes to the laptop, which makes
 * the stickers. 2) the phone follows along: pick sheets here or on the laptop
 * (both stay in step) and pay here. Printing happens at the booth.
 */
export default function PhoneSnap({ code, eventSlug }: { code: string; eventSlug?: string }) {
  // event booths: the guest signs up here first (email, name, consents), and the order they make is theirs
  const event = getPartyEvent(eventSlug);
  const needsGuest = !!event?.collectGuest;
  const [guest, setGuest] = useState<SavedGuest | null>(null);
  const [guestChecked, setGuestChecked] = useState(false);
  useEffect(() => {
    if (event) setGuest(loadSavedGuest(event.slug));
    setGuestChecked(true);
  }, [event]);
  const valid = /^[a-z0-9]{8,24}$/.test(code);
  const [shot, setShot] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [laptop, setLaptop] = useState<LaptopState | null>(null);
  const [picked, setPicked] = useState<SheetKind[]>(["pose"]);
  const lastLocalPick = useRef(0);
  const [printAsked, setPrintAsked] = useState(false);
  const selfieRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const post = (body: object) =>
    fetch("/api/booth/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p: code, role: "phone", ...body }) });

  // tell the laptop we're here (it shows "Phone connected")
  useEffect(() => {
    if (valid) post({ hello: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  // follow the laptop once the photo is in
  useEffect(() => {
    if (!valid || !sent) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/booth/pair?p=${code}`, { cache: "no-store" });
        const d: Pair = await r.json();
        if (!alive || !d.laptop) return;
        setLaptop(d.laptop);
        // the laptop's sheets win unless the guest just changed them here
        if (Date.now() - lastLocalPick.current > 4000 && d.laptop.picked?.length) setPicked(d.laptop.picked as SheetKind[]);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [valid, sent, code]);

  const claimed = useRef<string | null>(null);
  useEffect(() => {
    const id = laptop?.orderId;
    if (!guest || !id || claimed.current === id) return;
    claimed.current = id;
    claimOrder(id, guest).catch(() => {});
  }, [guest, laptop?.orderId]);

  /** Square-crop to 1024² JPEG, like the booth camera. */
  const load = (file: File) => {
    setError(null);
    const img = new Image();
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = Math.min(size, 1024);
      canvas.getContext("2d")!.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, canvas.width, canvas.height);
      setShot(canvas.toDataURL("image/jpeg", 0.88));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => setError("Couldn't read that photo. Try another one.");
    img.src = URL.createObjectURL(file);
  };

  const send = async () => {
    if (!shot) return;
    setSending(true);
    setError(null);
    try {
      const r = await post({ photo: shot });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "send failed");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send it. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const toggle = (id: SheetKind) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : SHEET_DESIGNS.map((d) => d.id).filter((x) => x === id || picked.includes(x));
    if (!next.length) return; // keep at least one
    lastLocalPick.current = Date.now();
    setPicked(next);
    post({ picked: next, seq: Date.now() }).catch(() => {});
  };

  const fileInput = (ref: React.RefObject<HTMLInputElement | null>, selfie: boolean) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      {...(selfie ? { capture: "user" as const } : {})}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) load(f);
        e.target.value = "";
      }}
    />
  );

  const step = laptop?.step ?? "";
  // event booths with their own look print one fixed sheet: no picking
  const single = !!getPartyEvent(laptop?.event ?? eventSlug)?.look;
  const pickedKey = picked.join("+");
  const payReady = !!laptop?.payUrl && laptop.payFor === pickedKey;
  const price = bundlePrice(picked.length);

  return (
    <div className="booth fixed inset-0 z-40 flex flex-col items-center overflow-auto px-6 pb-10 pt-8 text-center" style={{ gap: 18 }}>
      <div className="font-fun text-2xl font-bold">
        Me<span className="pop">Sticker</span>
      </div>

      {needsGuest && event && guestChecked && !guest && (
        <GuestSignup
          event={event}
          cta="Take my photo 📸"
          onCancel={() => history.back()}
          onDone={(g) => {
            saveGuest(event.slug, g);
            setGuest(g);
          }}
        />
      )}
      {!valid ? (
        <p className="t-lead">This link has expired. Scan the QR code on the booth screen again.</p>
      ) : !sent ? (
        <>
          <h1 className="t-h2 !text-[32px]">
            {shot ? (
              <>
                Looking <span className="pop">good!</span>
              </>
            ) : (
              <>
                Snap a <span className="pop">selfie</span>
              </>
            )}
          </h1>
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt="Your photo" className="card aspect-square w-[min(80vw,380px)] object-cover" />
          ) : (
            <p className="t-lead max-w-sm">Take a selfie or pick a photo. Your stickers appear on the booth screen in about 30 seconds.</p>
          )}
          {fileInput(selfieRef, true)}
          {fileInput(uploadRef, false)}
          <div className="flex w-full max-w-sm flex-col" style={{ gap: 12 }}>
            {shot ? (
              <>
                <button className="btn btn-lg btn-main" disabled={sending} onClick={send}>
                  {sending ? "Sending…" : "Use this! →"}
                </button>
                <button className="btn btn-soft" disabled={sending} onClick={() => setShot(null)}>
                  Retake
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-lg btn-main" onClick={() => selfieRef.current?.click()}>
                  🤳 Take a selfie
                </button>
                <button className="btn btn-soft" onClick={() => uploadRef.current?.click()}>
                  🖼️ Upload a photo
                </button>
              </>
            )}
          </div>
          {error && <p className="t-body text-[var(--pink)]">{error}</p>}
          <p className="t-body max-w-sm opacity-70">👯 Groups welcome. 🤪 Big faces make the best stickers.</p>
        </>
      ) : step === "attract" ? (
        <p className="t-lead max-w-sm">This session has ended. Scan the QR code on the booth screen to start again.</p>
      ) : step === "printing" || step === "done" || laptop?.paid ? (
        <>
          <motion.div style={{ fontSize: 72 }} initial={{ scale: 0.4 }} animate={{ scale: 1 }}>
            🎉
          </motion.div>
          <h1 className="t-h2 !text-[32px]">
            {laptop?.freeMode ? "Printing" : "Paid!"} <span className="pop">Printing now</span>
          </h1>
          <p className="t-lead max-w-sm">Your sheets are printing at the booth. It takes about 2 minutes a sheet: head over to collect them.</p>
          {guest && <p className="t-body max-w-sm">We&apos;ll also email all your stickers to {guest.email}.</p>}
          {laptop?.sticker && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={laptop.sticker} alt="Your sticker" className="die-cut w-[min(60vw,280px)]" />
          )}
        </>
      ) : step === "sheets" || step === "reveal" ? (
        <>
          {laptop?.sticker ? (
            <motion.img
              src={laptop.sticker}
              alt="Your sticker"
              className="die-cut w-[min(55vw,260px)]"
              initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: -3, opacity: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 12 }}
            />
          ) : (
            <div style={{ fontSize: 56 }}>✨</div>
          )}
          <h1 className="t-h2 !text-[28px]">
            {single ? (
              <>
                Look at <span className="pop">you!</span>
              </>
            ) : (
              <>
                Pick your <span className="pop">sheets</span>
              </>
            )}
          </h1>
          <p className="t-body -mt-2">{single ? "Your sheet gets this cartoon plus 8 festive poses." : "Same as on the booth screen: change them here or there."}</p>
          <div className={single ? "hidden" : "flex w-full max-w-sm flex-col"} style={{ gap: 10 }}>
            {SHEET_DESIGNS.map((d) => {
              const on = picked.includes(d.id);
              return (
                <button
                  key={d.id}
                  className={on ? "btn btn-main justify-between" : "btn btn-soft justify-between"}
                  style={{ textAlign: "left" }}
                  onClick={() => toggle(d.id)}
                >
                  <span>
                    {d.emoji} {d.name}
                    <span className="block text-xs font-normal opacity-80">{d.blurb} · {STICKERS_PER_SHEET} stickers</span>
                  </span>
                  <span>{on ? "✓" : "+ Add"}</span>
                </button>
              );
            })}
          </div>
          <div className="flex w-full max-w-sm flex-col" style={{ gap: 8 }}>
            {laptop?.freeMode ? (
              <button
                className="btn btn-lg btn-main"
                disabled={printAsked}
                onClick={() => {
                  setPrintAsked(true);
                  post({ print: true }).catch(() => setPrintAsked(false));
                }}
              >
                {printAsked ? "Sending to the printer…" : single ? "🖨️ Print my stickers" : `🖨️ Print ${picked.length === 1 ? "my sheet" : `my ${picked.length} sheets`}`}
              </button>
            ) : payReady ? (
              <a className="btn btn-lg btn-main justify-center" href={laptop!.payUrl!}>
                Pay {priceLabel(price)} →
              </a>
            ) : (
              <button className="btn btn-lg btn-main opacity-70" disabled>
                Getting checkout ready…
              </button>
            )}
            <p className="t-body text-xs opacity-70">
              {laptop?.freeMode ? "Free today!" : "Apple Pay · Google Pay · card"} · prints at the booth right after
            </p>
          </div>
        </>
      ) : (
        <>
          {shot && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt="Your photo" className="card aspect-square w-[min(50vw,220px)] object-cover" />
          )}
          <motion.h1 className="t-h2 !text-[28px]" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.8, repeat: Infinity }}>
            Making your <span className="pop">stickers</span>…
          </motion.h1>
          <p className="t-lead max-w-sm">Watch the booth screen. In about 30 seconds you can pick your sheets here or there.</p>
        </>
      )}
    </div>
  );
}
