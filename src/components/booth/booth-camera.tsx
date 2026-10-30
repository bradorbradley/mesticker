"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/booth-sounds";
import Mascot from "./mascot";
import { u } from "./units";

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

  const retake = () => {
    sounds.tap();
    setShot(null);
    setReady(false);
    onBackToLive(videoRef, streamRef, setReady);
  };

  return (
    <div
      className="flex h-full w-full items-center justify-center landscape:flex-row portrait:flex-col"
      style={{ gap: u(3), padding: `0 ${u(4)} ${u(2.5)}` }}
    >
      {/* tips + mascot */}
      <div className="flex flex-col landscape:w-[30%] portrait:items-center portrait:text-center" style={{ gap: u(1.6) }}>
        <h2 className="t-h2">{shot ? <>Looking <span className="pop">good!</span></> : <>Strike a <span className="pop">pose!</span></>}</h2>
        {!shot && (
          <ul className="t-lead portrait:hidden" style={{ display: "grid", gap: u(0.8) }}>
            <li>⬆️ Look at the camera above the screen</li>
            <li>👯 Groups welcome — squeeze in!</li>
            <li>🤪 Big faces make the best stickers</li>
          </ul>
        )}
        <Mascot className="self-start portrait:hidden" flash={flash} mood={count !== null ? "working" : "idle"} style={{ height: u(20) }} />
      </div>

      {/* viewfinder */}
      <div className="flex min-h-0 flex-col items-center justify-center landscape:h-full landscape:flex-1 portrait:w-full portrait:min-h-0 portrait:flex-1" style={{ gap: u(1.8) }}>
        <div
          className="card relative aspect-square min-h-0 overflow-hidden bg-[var(--lav)]"
          style={{ height: "min(100%, 82vw)", maxHeight: u(38), borderWidth: u(0.7) }}
        >
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt="Your photo" className="h-full w-full object-cover" />
          ) : (
            <video ref={videoRef} playsInline muted onLoadedData={() => setReady(true)} className="h-full w-full scale-x-[-1] object-cover" />
          )}
          {!ready && !shot && !error && (
            <div className="t-lead absolute inset-0 flex items-center justify-center">Warming up the camera…</div>
          )}
          {error && <div className="t-lead absolute inset-0 flex items-center justify-center p-6 text-center text-[var(--pink)]">{error}</div>}
          <AnimatePresence>
            {count !== null && (
              <motion.div
                key={count}
                className="font-fun absolute inset-0 flex items-center justify-center font-bold text-white"
                style={{ fontSize: u(18), textShadow: "0 0.08em 0.3em rgba(91,63,214,0.6)" }}
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

        <div className="flex shrink-0 flex-wrap items-center justify-center" style={{ gap: u(1.2) }}>
          {shot ? (
            <>
              <button className="btn btn-soft" onClick={retake}>
                Retake
              </button>
              <button className="btn btn-lg btn-main" onClick={() => { sounds.tap(); onCapture(shot); }}>
                Use this! →
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-soft" onClick={onBack}>
                ← Styles
              </button>
              <button className="btn btn-lg btn-main" disabled={!ready || count !== null} onClick={startCountdown}>
                {count !== null ? "Smile! 😁" : "📸 I'm ready"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* full-screen flash */}
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
