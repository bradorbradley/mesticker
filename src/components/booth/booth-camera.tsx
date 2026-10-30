"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/booth-sounds";
import Mascot from "./mascot";

/**
 * Live camera with a 3-2-1 countdown, screen flash and retake/keep review.
 * Captures a mirrored, center-cropped 1024² JPEG.
 */
export default function BoothCamera({
  onCapture,
  onBack,
}: {
  onCapture: (photo: string) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [shot, setShot] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setError("Camera isn't available. Ask staff to check the camera permission."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(size, 1024);
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      canvas.width,
      canvas.height
    );
    setShot(canvas.toDataURL("image/jpeg", 0.9));
  }, []);

  const startCountdown = () => {
    if (count !== null) return;
    sounds.unlock();
    let n = 3;
    setCount(n);
    sounds.tick();
    const id = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCount(n);
        sounds.tick();
        return;
      }
      clearInterval(id);
      setCount(null);
      sounds.shutter();
      setFlash(true);
      capture();
      setTimeout(() => setFlash(false), 450);
    }, 1000);
  };

  return (
    <div className="flex h-full w-full items-center gap-10 px-12 pb-8">
      {/* Left: tips + mascot */}
      <div className="flex h-full w-[30%] flex-col justify-center gap-6">
        <h2 className="display text-[clamp(36px,4vw,60px)] leading-[1]">
          {shot ? (
            <>
              Looking <em className="italic text-[var(--coral)]">good.</em>
            </>
          ) : (
            <>
              Strike a <em className="italic text-[var(--coral)]">pose.</em>
            </>
          )}
        </h2>
        {!shot && (
          <ul className="space-y-3 text-[clamp(17px,1.5vw,22px)] text-[var(--ink-2)]">
            <li>⬆️ Look at the camera above the screen</li>
            <li>👯 Groups welcome — squeeze in!</li>
            <li>😄 Big expressions make the best stickers</li>
          </ul>
        )}
        <Mascot className="h-[38vh] w-auto self-start" flash={flash} mood={count !== null ? "working" : "idle"} />
      </div>

      {/* Right: viewfinder */}
      <div className="relative flex h-full flex-1 flex-col items-center justify-center gap-6">
        <div className="relative aspect-square h-[min(68vh,100%)] overflow-hidden rounded-[36px] border-[10px] border-white bg-[var(--ground)] shadow-[0_24px_60px_rgba(31,32,48,0.18)]">
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt="Your photo" className="h-full w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedData={() => setReady(true)}
              className="h-full w-full scale-x-[-1] object-cover"
            />
          )}
          {!ready && !shot && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-xl text-[var(--ink-3)]">
              Warming up the camera…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-10 text-center text-xl text-[var(--coral)]">
              {error}
            </div>
          )}
          <AnimatePresence>
            {count !== null && (
              <motion.div
                key={count}
                className="display absolute inset-0 flex items-center justify-center text-[28vh] font-semibold text-white"
                style={{ textShadow: "0 8px 40px rgba(0,0,0,0.35)" }}
                initial={{ scale: 1.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                {count}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-5">
          {shot ? (
            <>
              <button className="btn-ghost px-10 py-5 text-2xl" onClick={() => { sounds.tap(); setShot(null); setReady(false); onBackToLive(videoRef, streamRef, setReady); }}>
                Retake
              </button>
              <button className="btn-primary px-14 py-5 text-2xl" onClick={() => { sounds.tap(); onCapture(shot); }}>
                Use this photo →
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost px-8 py-5 text-xl" onClick={onBack}>
                ← Styles
              </button>
              <button
                className="btn-primary px-14 py-5 text-2xl disabled:opacity-50"
                disabled={!ready || count !== null}
                onClick={startCountdown}
              >
                {count !== null ? "Smile!" : "📸 I'm ready"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Full-screen flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50 bg-white"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** After a retake the <video> remounts; reattach the still-running stream. */
function onBackToLive(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  streamRef: React.RefObject<MediaStream | null>,
  setReady: (v: boolean) => void
) {
  requestAnimationFrame(() => {
    const v = videoRef.current;
    if (v && streamRef.current) {
      v.srcObject = streamRef.current;
      v.play().then(() => setReady(true)).catch(() => {});
    }
  });
}
