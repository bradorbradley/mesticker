"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import BoothCamera from "@/components/booth/booth-camera";
import LoadingState from "@/components/loading-state";
import { STICKERS_PER_SHEET, bundlePrice, priceLabel } from "@/lib/booth-config";
import { STREET_POSES, localImage, makeIdeas, makeMainSticker, makePoses, newCode, newOrderId, toDataUrl, uploadImage } from "@/lib/street-client";

/**
 * Street mode, on the guest's own phone (they scanned the seller's QR):
 * selfie → their sticker + 7 poses → pay (Stripe, or cash to the seller).
 * Every sticker is saved to the order the moment it's made, so the seller's
 * phone can build the sheet even after this tab leaves for Stripe.
 */

type Step = "intro" | "camera" | "making" | "ready" | "paying" | "error";
const MAX_TRIES = 3;
const ORDER_KEY = "mesticker-street-order";

type Poses = (string | null | false)[];
const EMPTY: Poses = Array.from({ length: STREET_POSES }, () => null);

export default function StreetGuest({ resumeId }: { resumeId?: string }) {
  const [step, setStep] = useState<Step>("intro");
  const [photo, setPhoto] = useState<string | null>(null);
  const [main, setMain] = useState<string | null>(null);
  const [poses, setPoses] = useState<Poses>(EMPTY);
  const [tries, setTries] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const order = useRef<{ id: string; code: string } | null>(null);
  const gen = useRef(0);
  const price = priceLabel(bundlePrice(1));

  const ensureOrder = () => {
    if (!order.current) {
      order.current = { id: newOrderId(), code: newCode() };
      try {
        localStorage.setItem(ORDER_KEY, order.current.id);
      } catch {}
    }
    return order.current;
  };

  const save = useCallback((patch: object) => {
    const o = order.current;
    if (!o) return Promise.resolve();
    return fetch("/api/street/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id, code: o.code, ...patch }) }).catch(() => {});
  }, []);

  /** Make (or finish making) the 7 poses, saving each one as it lands. */
  const runPoses = useCallback(
    async (image: string, slots: number[], knownIdeas: string[] | null, g: number) => {
      try {
        const ideas = knownIdeas?.length ? knownIdeas : await makeIdeas(image);
        if (g !== gen.current) return;
        if (!knownIdeas?.length) save({ ideas });
        await makePoses(image, ideas, slots, async (i, img) => {
          if (g !== gen.current) return;
          setPoses((p) => p.map((v, k) => (k === i ? img : v)));
          if (img) {
            const url = await uploadImage(img).catch(() => null);
            if (url && g === gen.current) save({ poses: Array.from({ length: STREET_POSES }, (_, k) => (k === i ? url : null)) });
          }
        });
      } catch {
        if (g === gen.current) setPoses((p) => p.map((v) => (v === null ? false : v)));
      }
    },
    [save]
  );

  const generate = useCallback(
    async (image: string) => {
      const g = ++gen.current;
      ensureOrder();
      setPhoto(image);
      setMain(null);
      setPoses(EMPTY);
      setError(null);
      setTries((t) => t + 1);
      setStep("making");
      // photo first, so the seller's phone can remake any pose this tab doesn't finish
      uploadImage(image)
        .then((photoUrl) => {
          if (g === gen.current) save({ photoUrl });
        })
        .catch(() => {});
      runPoses(image, Array.from({ length: STREET_POSES }, (_, i) => i), null, g);
      try {
        const sticker = await makeMainSticker(image);
        if (g !== gen.current) return;
        setMain(sticker);
        setStep("ready");
        const mainUrl = await uploadImage(sticker);
        if (g === gen.current) save({ mainUrl });
      } catch (e) {
        if (g !== gen.current) return;
        setError(e instanceof Error ? e.message : "Something went wrong");
        setStep("error");
      }
    },
    [runPoses, save]
  );

  // Back from Stripe without paying (or reopened the link): pick the order back up.
  useEffect(() => {
    let id = resumeId;
    if (!id) return;
    fetch(`/api/street/order?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (o) => {
        if (!o?.mainUrl) return;
        if (o.payment !== "none") return location.replace(`/street/done?o=${o.id}`);
        order.current = { id: o.id, code: o.code };
        setMain(localImage(o.mainUrl));
        const known: Poses = (o.poses as (string | null)[]).map((p) => (p ? localImage(p) : null));
        setPoses(known);
        setStep("ready");
        const missing = known.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
        if (missing.length && o.photoUrl) {
          const image = await toDataUrl(o.photoUrl).catch(() => null);
          if (image) {
            setPhoto(image);
            runPoses(image, missing, o.ideas, gen.current);
          }
        }
      })
      .catch(() => {});
    id = undefined;
  }, [resumeId, runPoses]);

  const pay = async () => {
    const o = order.current;
    if (!o) return;
    setStep("paying");
    setError(null);
    try {
      // give the main sticker's upload a moment if it's still on its way
      for (let i = 0; i < 20; i++) {
        const s = await fetch(`/api/street/order?id=${o.id}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
        if (s?.mainUrl) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      const r = await fetch("/api/street/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id }) });
      const d = await r.json();
      if (d.url) return void (location.href = d.url);
      if (d.free || d.already) return void (location.href = `/street/done?o=${o.id}`);
      throw new Error(d.error || "Payment is down");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment is down");
      setStep("ready");
    }
  };

  const payCash = async () => {
    const o = order.current;
    if (!o) return;
    setStep("paying");
    const r = await fetch("/api/street/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id, action: "cash" }) }).catch(() => null);
    if (r?.ok) location.href = `/street/done?o=${o.id}`;
    else {
      setError("Couldn't send that. Try again in a second.");
      setStep("ready");
    }
  };

  const madeCount = poses.filter(Boolean).length;
  const doneCount = poses.filter((p) => p !== null).length;

  return (
    <div className="booth fixed inset-0 z-40 overflow-y-auto">
      {step === "camera" ? (
        <BoothCamera onCapture={generate} onBack={() => setStep(main ? "ready" : "intro")} />
      ) : (
        <div className="mx-auto flex min-h-full max-w-md flex-col items-center px-5 pb-10 pt-6 text-center" style={{ gap: 18 }}>
          <div className="font-fun text-2xl font-bold">
            Me<span className="pop">Sticker</span>
          </div>

          {step === "intro" && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/booth/mascot.webp" alt="" className="h-48 object-contain" />
              <h1 className="t-h2 !text-[38px] leading-tight">
                Turn yourself into a <span className="pop">sticker sheet</span>
              </h1>
              <p className="t-lead">
                Snap a selfie, see your sticker free, and get {STICKERS_PER_SHEET} printed right here for {price}.
              </p>
              <button className="btn btn-lg btn-main w-full" onClick={() => setStep("camera")}>
                📸 Take my selfie
              </button>
            </>
          )}

          {step === "making" && (
            <div className="w-full">
              <LoadingState photo={photo} />
            </div>
          )}

          {(step === "ready" || step === "paying") && main && (
            <>
              <h1 className="t-h2 !text-[32px]">
                That&apos;s <span className="pop">you!</span>
              </h1>
              <motion.img
                src={main}
                alt="Your sticker"
                className="die-cut w-[min(72vw,360px)]"
                initial={{ scale: 0.4, rotate: -15, opacity: 0 }}
                animate={{ scale: 1, rotate: -3, opacity: 1 }}
                transition={{ type: "spring", stiffness: 160, damping: 12 }}
              />
              <div className="w-full">
                <div className="t-body mb-2">
                  {doneCount < STREET_POSES ? `Drawing your 7 poses… ${madeCount}/${STREET_POSES}` : `Your sheet: you + ${madeCount || STREET_POSES} poses`}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {poses.map((p, i) => (
                    <div key={i} className="flex aspect-square items-center justify-center rounded-lg bg-white/70">
                      {p ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <motion.span animate={{ opacity: p === false ? 0.3 : [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: p === false ? 0 : Infinity }}>
                          ✨
                        </motion.span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn btn-lg btn-main w-full" onClick={pay} disabled={step === "paying"}>
                {step === "paying" ? "One sec…" : `🖨️ Print my sheet · ${price}`}
              </button>
              <div className="t-body -mt-2">Apple Pay, Google Pay or card. The rest of your poses finish while it prints.</div>
              <div className="flex w-full gap-2">
                <button className="btn btn-soft flex-1" onClick={payCash} disabled={step === "paying"}>
                  💵 I&apos;ll pay cash
                </button>
                {tries < MAX_TRIES && (
                  <button className="btn btn-soft flex-1" onClick={() => setStep("camera")} disabled={step === "paying"}>
                    🔄 Retake
                  </button>
                )}
              </div>
              {error && <p className="t-body text-[var(--pink)]">{error}</p>}
            </>
          )}

          {step === "error" && (
            <>
              <h1 className="t-h2 !text-[30px]">That one didn&apos;t work</h1>
              <p className="t-lead">{error?.includes("refus") ? "The AI couldn't use that photo. Try one with just your face, well lit." : "Let's try that again."}</p>
              {tries < MAX_TRIES ? (
                <button className="btn btn-lg btn-main w-full" onClick={() => (photo ? generate(photo) : setStep("camera"))}>
                  Try again
                </button>
              ) : (
                <p className="t-body">Show this screen to the seller and they&apos;ll sort you out.</p>
              )}
              <button className="btn btn-soft w-full" onClick={() => setStep("camera")}>
                New selfie
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
