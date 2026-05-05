"use client";

/**
 * Multi-platform share modal.
 *
 * The share artifact is a watermarked 1080x1080 card (cartoon + brand +
 * URL) so the brand survives any crop/repost. Comes with platform-specific
 * shortcuts (native share, Twitter/X intent, Threads intent, copy link).
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Copy, Check, Twitter, Loader2, Download, MessageCircle } from "lucide-react";
import { composeShareCard } from "@/lib/compose-share-card";
import { trackImageShare } from "@/lib/analytics";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

interface ShareModalProps {
  cartoonImage: string;
  open: boolean;
  onClose: () => void;
}

const SHARE_TEXT = "Just made a cartoon sticker of myself at mesticker.fun ✨ make yours →";
const SHARE_URL = "https://mesticker.fun";
const HASHTAGS = "MeSticker,AIstickers,custom";

export default function ShareModal({ cartoonImage, open, onClose }: ShareModalProps) {
  const [card, setCard] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!cartoonImage) return;
    if (card) return;
    setComposing(true);
    composeShareCard(cartoonImage)
      .then(setCard)
      .catch((err) => console.error("Share card compose failed:", err))
      .finally(() => setComposing(false));
  }, [open, cartoonImage, card]);

  const shareCardOrCartoon = card || cartoonImage;

  const nativeShare = async () => {
    trackImageShare();
    hapticLight();
    if (navigator.share) {
      try {
        const res = await fetch(shareCardOrCartoon);
        const blob = await res.blob();
        const file = new File([blob], "mesticker.png", { type: "image/png" });
        await navigator.share({
          title: "My MeSticker",
          text: SHARE_TEXT,
          url: SHARE_URL,
          files: [file],
        });
      } catch {}
    } else {
      shareToTwitter();
    }
  };

  const shareToTwitter = () => {
    trackImageShare();
    hapticLight();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      SHARE_TEXT
    )}&url=${encodeURIComponent(SHARE_URL)}&hashtags=${encodeURIComponent(HASHTAGS)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareToThreads = () => {
    trackImageShare();
    hapticLight();
    const url = `https://www.threads.net/intent/post?text=${encodeURIComponent(
      `${SHARE_TEXT} ${SHARE_URL}`
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareToReddit = () => {
    trackImageShare();
    hapticLight();
    const url = `https://www.reddit.com/submit?url=${encodeURIComponent(
      SHARE_URL
    )}&title=${encodeURIComponent(SHARE_TEXT)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyLink = () => {
    trackImageShare();
    hapticSuccess();
    navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCard = () => {
    if (!shareCardOrCartoon) return;
    hapticLight();
    const link = document.createElement("a");
    link.href = shareCardOrCartoon;
    link.download = `mesticker-share-${Date.now()}.png`;
    link.click();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl p-5 max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <Share2 size={18} />
                Share your sticker
              </h3>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            {/* Preview of the watermarked share card */}
            <div className="rounded-2xl overflow-hidden bg-muted/20 border border-border mb-3 aspect-square flex items-center justify-center">
              {composing ? (
                <Loader2 size={28} className="animate-spin text-primary" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shareCardOrCartoon}
                  alt="Share preview"
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-3 text-center">
              Watermarked with mesticker.fun so the brand survives any crop or repost.
            </p>

            {/* Primary: native share */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={nativeShare}
              className="w-full py-3 rounded-xl font-bold text-sm btn-gradient shadow-glow flex items-center justify-center gap-2 mb-2"
            >
              <Share2 size={16} />
              Share to apps
            </motion.button>

            {/* Platform-specific row */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={shareToTwitter}
                className="py-3 rounded-xl glass-strong border border-border shadow-soft flex flex-col items-center gap-1 text-[10px] font-semibold"
              >
                <Twitter size={16} className="text-primary" />
                X
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={shareToThreads}
                className="py-3 rounded-xl glass-strong border border-border shadow-soft flex flex-col items-center gap-1 text-[10px] font-semibold"
              >
                <MessageCircle size={16} className="text-primary" />
                Threads
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={shareToReddit}
                className="py-3 rounded-xl glass-strong border border-border shadow-soft flex flex-col items-center gap-1 text-[10px] font-semibold"
              >
                <MessageCircle size={16} className="text-primary" />
                Reddit
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={downloadCard}
                className="py-3 rounded-xl glass-strong border border-border shadow-soft flex flex-col items-center gap-1 text-[10px] font-semibold"
              >
                <Download size={16} className="text-primary" />
                Save
              </motion.button>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={copyLink}
              className="w-full py-2.5 rounded-xl glass-strong border border-border shadow-soft flex items-center justify-center gap-2 text-xs font-semibold"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy link + caption
                </>
              )}
            </motion.button>

            <p className="text-[10px] text-muted-foreground text-center mt-3">
              💡 For Instagram &amp; TikTok: tap <strong>Save</strong>, then upload the saved
              image as a post or story.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
