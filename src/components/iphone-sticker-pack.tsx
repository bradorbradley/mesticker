"use client";

/**
 * iPhone Sticker Pack — email-gated bonus.
 *
 * On iOS 17+, any transparent PNG saved to Photos is auto-promoted to an
 * iMessage sticker (long-press the image, "Add Sticker"). So we just hand
 * the user the 6 transparent PNGs after capturing their email.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, X, Download, Check, Loader2 } from "lucide-react";
import { trackEmailCapture } from "@/lib/analytics";
import { saveImagesToPhotos } from "@/lib/save-to-photos";

interface Variation {
  index: number;
  image: string | null;
}

interface Props {
  originalImage: string;
  variations: Variation[];
}

const KEY = "mesticker-iphone-stickers-unlocked";

function isUnlocked(): boolean {
  try { return localStorage.getItem(KEY) === "true"; } catch { return false; }
}
function setUnlocked() {
  try { localStorage.setItem(KEY, "true"); } catch {}
}

export default function IPhoneStickerPack({ originalImage, variations }: Props) {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlockedState] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [downloadedAll, setDownloadedAll] = useState(false);

  useEffect(() => {
    if (isUnlocked()) setUnlockedState(true);
  }, []);

  const allImages = useMemo(() => {
    const successful = variations.filter((v) => v.image).map((v) => v.image!);
    return [originalImage, ...successful];
  }, [originalImage, variations]);
  const ready = allImages.length >= 1;

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!emailInput.includes("@")) return;
      setSubmitting(true);
      try {
        await fetch("/api/email-capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailInput, source: "iphone-stickers" }),
        });
      } catch {}
      setUnlocked();
      setUnlockedState(true);
      trackEmailCapture();
      setSubmitting(false);
    },
    [emailInput]
  );

  const handleSaveAll = useCallback(async () => {
    const items = allImages.map((img, i) => ({
      url: img,
      filename: `mesticker-${i === 0 ? "original" : `pose-${i}`}.png`,
    }));
    const saved = await saveImagesToPhotos(items);
    if (saved > 0) setDownloadedAll(true);
  }, [allImages]);

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(true)}
        disabled={!ready}
        className="w-full py-2.5 rounded-xl font-semibold text-xs glass-strong border border-border shadow-soft flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Smartphone size={14} />
        {unlocked ? "Save iPhone stickers" : "Get these as iPhone stickers — free"}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl p-5 max-h-[85dvh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-base flex items-center gap-2">
                  <Smartphone size={18} />
                  iPhone Sticker Pack
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>

              {!unlocked ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Drop your email and we&apos;ll unlock all 7 stickers (your character + 6 poses)
                    so you can use them in iMessage, WhatsApp, and your photo library.
                  </p>
                  <form onSubmit={handleEmailSubmit} className="flex gap-2">
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="you@email.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-border text-sm bg-background"
                      autoComplete="email"
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2.5 rounded-xl font-bold text-sm btn-gradient shadow-glow disabled:opacity-50"
                    >
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : "Unlock"}
                    </motion.button>
                  </form>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    No spam. Just product updates and exclusive sticker drops.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Tap <strong>Save All</strong>, then on iPhone open Photos, long-press a sticker,
                    and tap <strong>Add Sticker</strong>. They&apos;ll appear in iMessage, WhatsApp,
                    and any keyboard sticker drawer.
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {allImages.map((img, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-lg bg-muted/30 overflow-hidden border border-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSaveAll}
                    className="w-full py-3 rounded-xl font-bold text-sm btn-gradient shadow-glow flex items-center justify-center gap-2"
                  >
                    {downloadedAll ? (
                      <>
                        <Check size={14} />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        Save All {allImages.length} Stickers
                      </>
                    )}
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
