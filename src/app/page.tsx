"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Lock,
  Sparkles,
  Download,
  Share2,
  Camera,
  ShoppingCart,
  Palette,
  Loader2,
  Plus,
  Check,
  X,
  Trash2,
} from "lucide-react";
import { formatPrice } from "@/lib/pricing";
import { useCart, FIRST_SHEET_CENTS, ADDITIONAL_SHEET_CENTS, pricePreview } from "@/lib/cart";
import LandingHero from "@/components/landing-hero";
import CameraCapture from "@/components/camera-capture";
import StyleGrid from "@/components/style-grid";
import LoadingState from "@/components/loading-state";
import ImageRevealSlider from "@/components/image-reveal";
import UnifiedCheckout from "@/components/unified-checkout";
import OrderConfirmation from "@/components/order-confirmation";
import Gallery from "@/components/gallery";
import UserMenu from "@/components/user-menu";
import IPhoneStickerPack from "@/components/iphone-sticker-pack";
import { useCreations } from "@/hooks/use-creations";
import { hapticLight, hapticMedium, hapticSuccess } from "@/lib/haptics";
import { getSessionId } from "@/lib/session";
import type { AppStep, StylePreset, Creation } from "@/types";
import {
  trackCapture,
  trackGenerateStart,
  trackGenerateComplete,
  trackGenerateError,
  trackCheckoutStart,
  trackPaymentComplete,
  trackLimitReached,
  trackEmailCapture,
  trackImageDownload,
  trackImageShare,
  trackRevealViewed,
  trackOrderClicked,
  trackTryAnotherClicked,
  trackProductTypeSelected,
} from "@/lib/analytics";

const FREE_GENERATION_LIMIT = 3;
const EMAIL_BONUS_LIMIT = 1;
const GEN_COUNT_KEY = "mesticker-gen-count";
const HAS_PURCHASED_KEY = "mesticker-has-purchased";
const SEEN_LANDING_KEY = "mesticker-seen-landing";
const EMAIL_CAPTURED_KEY = "mesticker-email-captured";

function getLocalGenCount() { try { return parseInt(localStorage.getItem(GEN_COUNT_KEY) || "0", 10); } catch { return 0; } }
function incrementLocalGenCount() { try { localStorage.setItem(GEN_COUNT_KEY, String(getLocalGenCount() + 1)); } catch {} }
function getLocalHasPurchased() { try { return localStorage.getItem(HAS_PURCHASED_KEY) === "true"; } catch { return false; } }
function setLocalHasPurchased() { try { localStorage.setItem(HAS_PURCHASED_KEY, "true"); } catch {} }
function getEmailCaptured() { try { return localStorage.getItem(EMAIL_CAPTURED_KEY) === "true"; } catch { return false; } }
function setEmailCaptured() { try { localStorage.setItem(EMAIL_CAPTURED_KEY, "true"); } catch {} }
function getEffectiveLimit() { return FREE_GENERATION_LIMIT + (getEmailCaptured() ? EMAIL_BONUS_LIMIT : 0); }

const pageVariants = {
  enter: { opacity: 0, y: 20, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.98 },
};

interface Variation {
  index: number;
  image: string | null;
  latency: number;
  variation: string;
  error?: string;
}

// Style-color gradients for skeleton tiles — keeps the grid alive while
// variations are still in flight.
const STYLE_GRADIENTS: Record<string, string> = {
  pixar: "from-blue-300/40 to-cyan-200/40",
  spongebob: "from-yellow-200/40 to-amber-300/40",
  simpsons: "from-yellow-300/40 to-yellow-400/40",
  "rick-and-morty": "from-green-300/40 to-emerald-400/40",
  "family-guy": "from-sky-300/40 to-blue-400/40",
  chibi: "from-pink-200/40 to-rose-300/40",
  anime: "from-purple-300/40 to-indigo-400/40",
  "comic-book": "from-red-300/40 to-orange-400/40",
  watercolor: "from-teal-200/40 to-cyan-300/40",
  random: "from-primary/40 to-accent-pink/40",
  custom: "from-violet-300/40 to-fuchsia-400/40",
};

function SkeletonTile({ styleId }: { styleId: string }) {
  const gradient = STYLE_GRADIENTS[styleId] || "from-muted/40 to-muted/20";
  return (
    <div className={`relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br ${gradient}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <Sparkles size={18} className="text-white/60" />
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session } = useSession();
  const cart = useCart();
  const [showLanding, setShowLanding] = useState(true);
  const [step, setStep] = useState<AppStep>("capture");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Variations + composed sheets
  const [variations, setVariations] = useState<Variation[]>([]);
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [packSheet, setPackSheet] = useState<string | null>(null); // composed Variations Pack
  const [composingTileIdx, setComposingTileIdx] = useState<number | null>(null);

  // Order state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState(0);
  const [orderQuantity, setOrderQuantity] = useState(0);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);

  // Generation limit
  const [limitReached, setLimitReached] = useState(false);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [serverHasPurchased, setServerHasPurchased] = useState(false);

  // Creations
  const { creations: localCreations, addCreation: addLocalCreation } = useCreations();
  const [dbCreations, setDbCreations] = useState<Creation[]>([]);

  const isSignedIn = !!session?.user;
  const displayCreations = isSignedIn ? dbCreations : localCreations;

  useEffect(() => { getSessionId(); }, []);
  useEffect(() => { try { if (localStorage.getItem(SEEN_LANDING_KEY) === "true") setShowLanding(false); } catch {} }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/user/orders")
      .then((r) => (r.ok ? r.json() : []))
      .then((orders) => {
        if (orders && orders.length > 0) {
          setServerHasPurchased(true);
          setLocalHasPurchased();
          setLimitReached(false);
        }
      })
      .catch(() => {});
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/creations").then((r) => (r.ok ? r.json() : [])).then(setDbCreations).catch(() => {});
  }, [isSignedIn]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success" || params.get("redirect_status") === "succeeded") {
      setPaymentComplete(true);
      setStep("order");
      setShowLanding(false);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleLandingStart = useCallback(() => {
    setShowLanding(false);
    try { localStorage.setItem(SEEN_LANDING_KEY, "true"); } catch {}
  }, []);

  const handleCapture = useCallback((imageBase64: string) => {
    setCapturedImage(imageBase64);
    setStep("style");
    trackCapture();
  }, []);

  const handleStyleSelect = useCallback(
    async (preset: StylePreset, customPrompt?: string) => {
      if (!capturedImage) return;

      const count = getLocalGenCount();
      const purchased = getLocalHasPurchased() || serverHasPurchased;
      const limit = getEffectiveLimit();
      if (count >= limit && !purchased) {
        if (!getEmailCaptured() && count >= FREE_GENERATION_LIMIT) {
          setShowEmailCapture(true);
          return;
        }
        setLimitReached(true);
        trackLimitReached();
        return;
      }

      setSelectedStyle(preset);
      setIsGenerating(true);
      setGenerateError(null);
      setGeneratedImage(null);
      setVariations([]);
      setPackSheet(null);
      setLimitReached(false);
      hapticMedium();

      const styleId = preset.id;
      trackGenerateStart(styleId);

      try {
        const body: Record<string, string> = { image: capturedImage };
        if (customPrompt) body.customPrompt = customPrompt;
        else body.styleId = styleId;

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          if (data.error === "FREE_LIMIT_REACHED") { setLimitReached(true); setIsGenerating(false); return; }
          if (data.error === "PROMPT_REJECTED") { setGenerateError("That style description wasn't allowed. Try something different!"); setIsGenerating(false); return; }
          throw new Error(data.error || "Generation failed");
        }

        const data = await res.json();
        setGeneratedImage(data.generatedImage);
        incrementLocalGenCount();
        trackGenerateComplete(data.stylePreset || styleId);
        hapticSuccess();

        addLocalCreation({
          originalImage: capturedImage,
          generatedImage: data.generatedImage,
          stylePreset: data.stylePreset || styleId,
          ordered: false,
        });

        if (isSignedIn) {
          try {
            const saveRes = await fetch("/api/creations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                originalImage: capturedImage,
                generatedImage: data.generatedImage,
                stylePreset: data.stylePreset || styleId,
              }),
            });
            if (saveRes.ok) {
              const saved = await saveRes.json();
              setDbCreations((prev) => [saved, ...prev]);
            }
          } catch {}
        }

        setStep("reveal");
        trackRevealViewed();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Something went wrong";
        setGenerateError(errMsg);
        trackGenerateError(errMsg);
      } finally {
        setIsGenerating(false);
      }
    },
    [capturedImage, addLocalCreation, isSignedIn, serverHasPurchased]
  );

  // As soon as we have a cartoon, kick off variations
  useEffect(() => {
    if (!generatedImage) return;
    if (variations.length > 0 || variationsLoading) return;
    setVariationsLoading(true);
    fetch("/api/variations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: generatedImage, originalPhoto: capturedImage }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.variations) setVariations(data.variations); })
      .catch(() => {})
      .finally(() => setVariationsLoading(false));
  }, [generatedImage, variations.length, variationsLoading]);

  // When 6+ variations land, compose the Pack sheet so it's ready when user clicks
  useEffect(() => {
    if (packSheet) return;
    const successful = variations.filter((v) => v.image).map((v) => v.image!);
    if (successful.length < 6) return;
    fetch("/api/compose-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: successful.slice(0, 6) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.composedImage) setPackSheet(data.composedImage); })
      .catch(() => {});
  }, [variations, packSheet]);

  const addPackToCart = useCallback(() => {
    if (!packSheet || !generatedImage) return;
    cart.addItem({
      kind: "variations",
      composedImage: packSheet,
      thumbnail: generatedImage,
      label: "Variations Pack — 6 poses of you",
    });
    trackProductTypeSelected("variations");
    hapticSuccess();
  }, [cart, packSheet, generatedImage]);

  const addSingleTileToCart = useCallback(
    async (tileImage: string, idx: number) => {
      setComposingTileIdx(idx);
      try {
        const res = await fetch("/api/compose-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: [tileImage], repeat: 6 }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.composedImage) {
          cart.addItem({
            kind: "single",
            composedImage: data.composedImage,
            thumbnail: tileImage,
            label: "Sheet of one design — 6 of this sticker",
          });
          trackProductTypeSelected("single");
          hapticSuccess();
        }
      } finally {
        setComposingTileIdx(null);
      }
    },
    [cart]
  );

  const startCheckout = useCallback(async () => {
    if (cart.items.length === 0) return;
    trackOrderClicked();
    trackCheckoutStart();

    setIsCreatingOrder(true);
    setPaymentError(null);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((i) => ({
            generatedImage: i.composedImage,
            stylePreset: selectedStyle?.id || "unknown",
            sheetVariant: i.kind === "variations" ? "pack" : "stack",
            tierId: "sheet-1",
          })),
          // Custom total override — cart pricing differs from per-item tier pricing
          totalCents: cart.totalCents,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Order creation failed");
      }
      const data = await res.json();
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setOrderAmount(data.amount);
      setOrderQuantity(cart.items.length);
      setShowCart(false);
      setStep("order");
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsCreatingOrder(false);
    }
  }, [cart, selectedStyle]);

  const handleTryAnotherStyle = useCallback(() => {
    trackTryAnotherClicked();
    setGeneratedImage(null);
    setSelectedStyle(null);
    setGenerateError(null);
    setVariations([]);
    setPackSheet(null);
    setStep("style");
  }, []);

  const handlePaymentSuccess = useCallback(() => {
    setPaymentComplete(true);
    setLimitReached(false);
    setLocalHasPurchased();
    cart.clear();
    trackPaymentComplete(orderAmount, orderQuantity);
  }, [orderAmount, orderQuantity, cart]);

  const handleNewSticker = useCallback(() => {
    setCapturedImage(null);
    setSelectedStyle(null);
    setGeneratedImage(null);
    setClientSecret(null);
    setPaymentIntentId(null);
    setOrderAmount(0);
    setOrderQuantity(0);
    setPaymentComplete(false);
    setPaymentError(null);
    setGenerateError(null);
    setVariations([]);
    setPackSheet(null);
    cart.clear();
    setStep("capture");
  }, [cart]);

  const handleGallerySelect = useCallback((creation: Creation) => {
    setCapturedImage(creation.originalImage);
    setGeneratedImage(creation.generatedImage);
    setSelectedStyle(null);
    setClientSecret(null);
    setPaymentError(null);
    setPaymentComplete(false);
    setVariations([]);
    setPackSheet(null);
    setStep("reveal");
    trackRevealViewed();
  }, []);

  const goBack = useCallback(() => {
    if (step === "style") {
      setGeneratedImage(null);
      setSelectedStyle(null);
      setGenerateError(null);
      setStep("capture");
    } else if (step === "reveal") {
      setGeneratedImage(null);
      setSelectedStyle(null);
      setVariations([]);
      setPackSheet(null);
      setStep("style");
    } else if (step === "order") {
      setClientSecret(null);
      setPaymentIntentId(null);
      setPaymentError(null);
      setStep("reveal");
    }
  }, [step]);

  const variationsForIPhone = useMemo(
    () => variations.map((v) => ({ index: v.index, image: v.image })),
    [variations]
  );

  if (showLanding) {
    return <LandingHero onStart={handleLandingStart} />;
  }

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-md px-4 py-5 safe-top">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          {step !== "capture" && !paymentComplete ? (
            <motion.button whileTap={{ scale: 0.9 }} onClick={goBack} className="w-9 h-9 rounded-full glass-strong shadow-soft flex items-center justify-center">
              <ArrowLeft size={16} />
            </motion.button>
          ) : (
            <div className="w-9" />
          )}
          <button onClick={() => { setShowLanding(true); handleNewSticker(); }} className="font-display text-xl font-bold gradient-text">
            MeSticker
          </button>
          <div className="flex items-center gap-1">
            {cart.count > 0 && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowCart(true)}
                className="relative w-9 h-9 rounded-full glass-strong shadow-soft flex items-center justify-center"
              >
                <ShoppingCart size={16} />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {cart.count}
                </span>
              </motion.button>
            )}
            <UserMenu />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "capture" && (
            <motion.div key="capture" variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: "easeOut" }}>
              <CameraCapture onCapture={handleCapture} />
              <Gallery creations={displayCreations} onSelect={handleGallerySelect} className="mt-6" />
            </motion.div>
          )}

          {step === "style" && (
            <motion.div key="style" variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: "easeOut" }}>
              {isGenerating ? (
                <LoadingState photo={capturedImage} />
              ) : (
                <div className="flex flex-col gap-3">
                  {capturedImage && (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shadow-card border-2 border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={capturedImage} alt="Your photo" className="w-full h-full object-cover" />
                      </div>
                      <button
                        onClick={() => { setCapturedImage(null); setSelectedStyle(null); setGeneratedImage(null); setGenerateError(null); setStep("capture"); }}
                        className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                      >
                        <Camera size={12} /> New photo
                      </button>
                    </div>
                  )}

                  <h2 className="font-display text-lg font-bold text-center">Tap a style to generate</h2>
                  {generateError && <p className="text-sm text-red-500 text-center">{generateError}</p>}

                  {showEmailCapture ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
                      <Sparkles size={24} className="mx-auto mb-2 text-primary" />
                      <p className="font-bold text-sm">Want 1 more free generation?</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-3">Drop your email and we&apos;ll unlock one more!</p>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (emailInput.includes("@")) {
                            try { await fetch("/api/email-capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailInput }) }); } catch {}
                            setEmailCaptured(); setShowEmailCapture(false); setLimitReached(false); trackEmailCapture();
                          }
                        }}
                        className="flex gap-2"
                      >
                        <input type="email" required placeholder="you@email.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-border text-sm bg-background" autoComplete="email" />
                        <motion.button whileTap={{ scale: 0.95 }} type="submit" className="px-4 py-2 rounded-xl font-bold text-sm btn-gradient shadow-glow">Unlock</motion.button>
                      </form>
                    </motion.div>
                  ) : limitReached ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-accent-orange/30 bg-accent-orange/5 p-5 text-center">
                      <Lock size={24} className="mx-auto mb-2 text-accent-orange" />
                      <p className="font-bold text-sm">Free generations used up</p>
                      <p className="text-xs text-muted-foreground mt-1">Order any sticker to unlock unlimited creations!</p>
                    </motion.div>
                  ) : (
                    <StyleGrid onSelect={handleStyleSelect} disabled={isGenerating} />
                  )}
                </div>
              )}
            </motion.div>
          )}

          {step === "reveal" && generatedImage && capturedImage && (
            <motion.div key="reveal" variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: "easeOut" }}>
              <div className="flex flex-col gap-4">
                {/* Reveal slider — auto-animates to show comparison */}
                <ImageRevealSlider beforeSrc={capturedImage} afterSrc={generatedImage} height={300} />

                {/* Save / Share */}
                <div className="flex gap-2 justify-center">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold glass-strong border border-border shadow-soft"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = generatedImage;
                      link.download = `mesticker-${Date.now()}.png`;
                      link.click();
                      trackImageDownload();
                    }}
                  >
                    <Download size={16} /> Save
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold glass-strong border border-border shadow-soft"
                    onClick={async () => {
                      trackImageShare();
                      if (navigator.share) {
                        try {
                          const res = await fetch(generatedImage);
                          const blob = await res.blob();
                          const file = new File([blob], "mesticker.png", { type: "image/png" });
                          await navigator.share({ title: "My MeSticker", text: "Check out my cartoon sticker from mesticker.fun!", files: [file] });
                        } catch {}
                      }
                    }}
                  >
                    <Share2 size={16} /> Share
                  </motion.button>
                </div>

                {/* 9-grid sticker pack with skeleton tiles */}
                <div className="rounded-2xl border border-border bg-card/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Your sticker pack
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {variations.filter((v) => v.image).length}/9 ready
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 9 }).map((_, i) => {
                      const v = variations[i];
                      const styleId = selectedStyle?.id || "random";
                      return (
                        <div key={i} className="relative">
                          {v?.image ? (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.3 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => { hapticLight(); addSingleTileToCart(v.image!, i); }}
                              disabled={composingTileIdx === i}
                              className="relative w-full aspect-square rounded-xl overflow-hidden bg-muted/30 border-2 border-border hover:border-primary transition-colors disabled:opacity-60"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={v.image} alt="" className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-black/0 hover:bg-black/40 active:bg-black/60 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100">
                                <div className="bg-white text-primary px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-lg">
                                  {composingTileIdx === i ? (
                                    <><Loader2 size={10} className="animate-spin" /> Adding</>
                                  ) : (
                                    <><Plus size={10} /> Sheet of this</>
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          ) : (
                            <SkeletonTile styleId={styleId} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    Tap any sticker to add a sheet of that one design to your cart
                  </p>
                </div>

                {/* Primary CTA — Variations Pack */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3.5 rounded-xl font-bold text-sm btn-gradient shadow-glow flex items-center justify-center gap-2 disabled:opacity-50"
                  onClick={addPackToCart}
                  disabled={!packSheet}
                >
                  {!packSheet ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Building your pack…
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={16} />
                      Add Variations Pack — {formatPrice(cart.count === 0 ? FIRST_SHEET_CENTS : ADDITIONAL_SHEET_CENTS)}
                    </>
                  )}
                </motion.button>

                {cart.count > 0 && (
                  <motion.button
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowCart(true)}
                    className="w-full py-2.5 rounded-xl font-semibold text-xs glass-strong border border-primary/30 shadow-soft flex items-center justify-center gap-2 text-primary"
                  >
                    <ShoppingCart size={14} />
                    View Cart ({cart.count}) — {formatPrice(cart.totalCents)} → Checkout
                  </motion.button>
                )}

                <IPhoneStickerPack originalImage={generatedImage} variations={variationsForIPhone} />

                <button className="text-sm text-primary font-semibold text-center flex items-center justify-center gap-1.5 py-1" onClick={handleTryAnotherStyle}>
                  <Palette size={14} /> Try Another Style
                </button>
              </div>
            </motion.div>
          )}

          {step === "order" && (
            <motion.div key="order" variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: "easeOut" }}>
              {paymentComplete ? (
                <OrderConfirmation
                  imageUrl={generatedImage || ""}
                  quantity={orderQuantity}
                  onNewSticker={handleNewSticker}
                />
              ) : isCreatingOrder ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Setting up checkout...</p>
                </div>
              ) : clientSecret && paymentIntentId ? (
                <div>
                  {paymentError && <p className="text-sm text-red-500 text-center mb-4">{paymentError}</p>}
                  <UnifiedCheckout
                    clientSecret={clientSecret}
                    paymentIntentId={paymentIntentId}
                    amount={orderAmount}
                    cartItems={cart.items.map((i, idx) => ({
                      id: i.id,
                      generatedImage: i.composedImage,
                      originalImage: capturedImage || "",
                      stylePreset: selectedStyle?.id || "unknown",
                      sheetVariant: i.kind === "variations" ? ("pack" as const) : ("stack" as const),
                      tierId: "sheet-1",
                    }))}
                    onSuccess={handlePaymentSuccess}
                    onError={setPaymentError}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  {paymentError && <p className="text-sm text-red-500 mb-4">{paymentError}</p>}
                  <p className="text-sm text-muted-foreground">Something went wrong. Please go back and try again.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cart drawer */}
        <AnimatePresence>
          {showCart && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
              onClick={() => setShowCart(false)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl p-5 max-h-[85dvh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-base flex items-center gap-2">
                    <ShoppingCart size={18} /> Your Cart ({cart.count})
                  </h3>
                  <button onClick={() => setShowCart(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <X size={14} />
                  </button>
                </div>

                {cart.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Your cart is empty.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 mb-4 max-h-[40dvh] overflow-y-auto">
                      {cart.items.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/30 border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.thumbnail} alt="" className="w-12 h-12 rounded-lg object-contain bg-background" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{item.label}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {idx === 0 ? formatPrice(FIRST_SHEET_CENTS) : `${formatPrice(ADDITIONAL_SHEET_CENTS)} (additional sheet)`}
                            </p>
                          </div>
                          <button onClick={() => cart.removeItem(item.id)} className="w-7 h-7 rounded-full bg-background flex items-center justify-center text-muted-foreground hover:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1 text-sm border-t border-border pt-3 mb-4">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(cart.subtotalCents)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="text-green-600 font-semibold">FREE</span></div>
                      <div className="flex justify-between pt-2 border-t border-border font-bold text-base"><span>Total</span><span>{formatPrice(cart.totalCents)}</span></div>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={startCheckout}
                      disabled={isCreatingOrder}
                      className="w-full py-3 rounded-xl font-bold text-sm btn-gradient shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isCreatingOrder ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Checkout — {formatPrice(cart.totalCents)}
                    </motion.button>
                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                      Free US shipping · ships in 3–5 days
                    </p>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
