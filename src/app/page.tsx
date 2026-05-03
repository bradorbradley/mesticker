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
  Layers,
  Grid3x3,
} from "lucide-react";
import { SHEET_TIERS, formatPrice } from "@/lib/pricing";
import LandingHero from "@/components/landing-hero";
import CameraCapture from "@/components/camera-capture";
import StyleGrid from "@/components/style-grid";
import LoadingState from "@/components/loading-state";
import UnifiedCheckout from "@/components/unified-checkout";
import OrderConfirmation from "@/components/order-confirmation";
import Gallery from "@/components/gallery";
import UserMenu from "@/components/user-menu";
import IPhoneStickerPack from "@/components/iphone-sticker-pack";
import { useCreations } from "@/hooks/use-creations";
import { hapticMedium, hapticSuccess } from "@/lib/haptics";
import { getSessionId } from "@/lib/session";
import type { AppStep, StylePreset, Creation, CartItem } from "@/types";
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

function getLocalGenCount(): number {
  try { return parseInt(localStorage.getItem(GEN_COUNT_KEY) || "0", 10); } catch { return 0; }
}
function incrementLocalGenCount() {
  try { localStorage.setItem(GEN_COUNT_KEY, String(getLocalGenCount() + 1)); } catch {}
}
function getLocalHasPurchased(): boolean {
  try { return localStorage.getItem(HAS_PURCHASED_KEY) === "true"; } catch { return false; }
}
function setLocalHasPurchased() {
  try { localStorage.setItem(HAS_PURCHASED_KEY, "true"); } catch {}
}
function getEmailCaptured(): boolean {
  try { return localStorage.getItem(EMAIL_CAPTURED_KEY) === "true"; } catch { return false; }
}
function setEmailCaptured() {
  try { localStorage.setItem(EMAIL_CAPTURED_KEY, "true"); } catch {}
}
function getEffectiveLimit(): number {
  return FREE_GENERATION_LIMIT + (getEmailCaptured() ? EMAIL_BONUS_LIMIT : 0);
}

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

export default function Home() {
  const { data: session } = useSession();
  const [showLanding, setShowLanding] = useState(true);
  const [step, setStep] = useState<AppStep>("capture");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Variations + composed sheets (auto-fired in background)
  const [variations, setVariations] = useState<Variation[]>([]);
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [packSheet, setPackSheet] = useState<string | null>(null); // 6 variations on a sheet
  const [stackSheet, setStackSheet] = useState<string | null>(null); // 6 of original on a sheet

  // Order state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState(0);
  const [orderQuantity, setOrderQuantity] = useState(0);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // Product picker
  const [sheetVariant, setSheetVariant] = useState<"pack" | "stack">("pack");
  const [selectedTierId, setSelectedTierId] = useState<string>("sheet-1");

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

  // Init session
  useEffect(() => { getSessionId(); }, []);

  useEffect(() => {
    try { if (localStorage.getItem(SEEN_LANDING_KEY) === "true") setShowLanding(false); } catch {}
  }, []);

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

  // Handle Stripe redirect return
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

  // Style selection triggers generation immediately
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
      setStackSheet(null);
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
          if (data.error === "FREE_LIMIT_REACHED") {
            setLimitReached(true);
            setIsGenerating(false);
            return;
          }
          if (data.error === "PROMPT_REJECTED") {
            setGenerateError("That style description wasn't allowed. Try something different!");
            setIsGenerating(false);
            return;
          }
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

  // Background: as soon as we have a generated cartoon, kick off variations + stack composition
  useEffect(() => {
    if (!generatedImage) return;

    // Compose Stack sheet (6 copies of original) — fast, server-side sharp
    if (!stackSheet) {
      fetch("/api/compose-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [generatedImage], repeat: 6 }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data?.composedImage) setStackSheet(data.composedImage); })
        .catch(() => {});
    }

    // Generate 6 variations using the cartoon as source (locks character identity)
    if (variations.length === 0 && !variationsLoading) {
      setVariationsLoading(true);
      fetch("/api/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: generatedImage }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data?.variations) setVariations(data.variations); })
        .catch(() => {})
        .finally(() => setVariationsLoading(false));
    }
  }, [generatedImage, stackSheet, variations.length, variationsLoading]);

  // Once variations land, compose them into a Pack sheet
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

  const handleBuyNow = useCallback(async () => {
    if (!generatedImage || !capturedImage) return;
    const sheetImage = sheetVariant === "pack" ? packSheet : stackSheet;
    if (!sheetImage) return;

    trackOrderClicked();
    trackProductTypeSelected(sheetVariant);

    const newCartItems: CartItem[] = [
      {
        id: `item-${Date.now()}`,
        generatedImage: sheetImage,
        originalImage: capturedImage,
        stylePreset: selectedStyle?.id || "unknown",
        sheetVariant,
        tierId: selectedTierId,
      },
    ];
    setCartItems(newCartItems);
    trackCheckoutStart();

    setIsCreatingOrder(true);
    setPaymentError(null);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: newCartItems.map((i) => ({
            generatedImage: i.generatedImage,
            stylePreset: i.stylePreset,
            sheetVariant: i.sheetVariant,
            tierId: i.tierId,
          })),
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
      const tier = SHEET_TIERS.find((t) => t.id === selectedTierId);
      setOrderQuantity(tier?.qty ?? 1);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsCreatingOrder(false);
    }
    setStep("order");
  }, [
    generatedImage,
    capturedImage,
    selectedStyle,
    sheetVariant,
    packSheet,
    stackSheet,
    selectedTierId,
  ]);

  const handleTryAnotherStyle = useCallback(() => {
    trackTryAnotherClicked();
    setGeneratedImage(null);
    setSelectedStyle(null);
    setGenerateError(null);
    setVariations([]);
    setPackSheet(null);
    setStackSheet(null);
    setStep("style");
  }, []);

  const handlePaymentSuccess = useCallback(() => {
    setPaymentComplete(true);
    setLimitReached(false);
    setLocalHasPurchased();
    trackPaymentComplete(orderAmount, orderQuantity);
  }, [orderAmount, orderQuantity]);

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
    setCartItems([]);
    setVariations([]);
    setPackSheet(null);
    setStackSheet(null);
    setVariationsLoading(false);
    setSheetVariant("pack");
    setSelectedTierId("sheet-1");
    setStep("capture");
  }, []);

  const handleGallerySelect = useCallback((creation: Creation) => {
    setCapturedImage(creation.originalImage);
    setGeneratedImage(creation.generatedImage);
    setSelectedStyle(null);
    setClientSecret(null);
    setPaymentError(null);
    setPaymentComplete(false);
    setVariations([]);
    setPackSheet(null);
    setStackSheet(null);
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
      setStackSheet(null);
      setStep("style");
    } else if (step === "order") {
      setClientSecret(null);
      setPaymentIntentId(null);
      setPaymentError(null);
      setStep("reveal");
    }
  }, [step]);

  const selectedTier = useMemo(
    () => SHEET_TIERS.find((t) => t.id === selectedTierId) ?? SHEET_TIERS[0],
    [selectedTierId]
  );

  const canBuy =
    sheetVariant === "pack"
      ? !!packSheet
      : !!stackSheet;

  if (showLanding) {
    return <LandingHero onStart={handleLandingStart} />;
  }

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-md px-4 py-5 safe-top">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          {step !== "capture" && !paymentComplete ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={goBack}
              className="w-9 h-9 rounded-full glass-strong shadow-soft flex items-center justify-center"
            >
              <ArrowLeft size={16} />
            </motion.button>
          ) : (
            <div className="w-9" />
          )}
          <button
            onClick={() => { setShowLanding(true); handleNewSticker(); }}
            className="font-display text-xl font-bold gradient-text"
          >
            MeSticker
          </button>
          <UserMenu />
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Capture */}
          {step === "capture" && (
            <motion.div key="capture" variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: "easeOut" }}>
              <CameraCapture onCapture={handleCapture} />
              <Gallery creations={displayCreations} onSelect={handleGallerySelect} className="mt-6" />
            </motion.div>
          )}

          {/* Step 2: Style Grid */}
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
                        onClick={() => {
                          setCapturedImage(null);
                          setSelectedStyle(null);
                          setGeneratedImage(null);
                          setGenerateError(null);
                          setStep("capture");
                        }}
                        className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                      >
                        <Camera size={12} />
                        New photo
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
                            try {
                              await fetch("/api/email-capture", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ email: emailInput }),
                              });
                            } catch {}
                            setEmailCaptured();
                            setShowEmailCapture(false);
                            setLimitReached(false);
                            trackEmailCapture();
                          }
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="email"
                          required
                          placeholder="you@email.com"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-border text-sm bg-background"
                          autoComplete="email"
                        />
                        <motion.button whileTap={{ scale: 0.95 }} type="submit" className="px-4 py-2 rounded-xl font-bold text-sm btn-gradient shadow-glow">
                          Unlock
                        </motion.button>
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

          {/* Step 3: Reveal — single screen with character + variations + buy */}
          {step === "reveal" && generatedImage && capturedImage && (
            <motion.div key="reveal" variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: "easeOut" }}>
              <div className="flex flex-col gap-4">
                {/* Hero — your character */}
                <div className="rounded-2xl overflow-hidden bg-muted/20 aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={generatedImage} alt="Your sticker" className="w-full h-full object-contain" />
                </div>

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
                          await navigator.share({
                            title: "My MeSticker",
                            text: "Check out my cartoon sticker from mesticker.fun!",
                            files: [file],
                          });
                        } catch {}
                      }
                    }}
                  >
                    <Share2 size={16} /> Share
                  </motion.button>
                </div>

                {/* Variations strip — auto-loading, no click required */}
                <div className="rounded-2xl border border-border bg-card/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Your sticker pack
                    </p>
                    {variationsLoading && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" />
                        Generating…
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const v = variations[i];
                      return (
                        <div key={i} className="aspect-square rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center">
                          {v?.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.image} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <Loader2 size={14} className="animate-spin text-muted-foreground/40" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Product picker — Pack vs Stack */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSheetVariant("pack")}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                      sheetVariant === "pack" ? "border-primary bg-primary/10" : "border-border bg-background"
                    }`}
                  >
                    <Grid3x3 size={18} className={sheetVariant === "pack" ? "text-primary" : "text-muted-foreground"} />
                    <span className="text-[12px] font-bold leading-tight">Pack of Me</span>
                    <span className="text-[10px] text-muted-foreground">6 different poses</span>
                  </button>
                  <button
                    onClick={() => setSheetVariant("stack")}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                      sheetVariant === "stack" ? "border-primary bg-primary/10" : "border-border bg-background"
                    }`}
                  >
                    <Layers size={18} className={sheetVariant === "stack" ? "text-primary" : "text-muted-foreground"} />
                    <span className="text-[12px] font-bold leading-tight">Stack of Me</span>
                    <span className="text-[10px] text-muted-foreground">6 of this sticker</span>
                  </button>
                </div>

                {/* Tier picker (1 / 2 / 3 sheets) */}
                <div className="grid grid-cols-3 gap-2">
                  {SHEET_TIERS.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setSelectedTierId(tier.id)}
                      className={`flex flex-col items-center py-2 rounded-xl border-2 transition-all ${
                        selectedTierId === tier.id ? "border-primary bg-primary/10 font-bold" : "border-border bg-background"
                      }`}
                    >
                      <span className="text-[11px] font-bold">{tier.label}</span>
                      <span className="text-[10px]">{formatPrice(tier.priceCents)}</span>
                      {"tag" in tier && tier.tag && (
                        <span className="text-[8px] text-primary font-bold mt-0.5">{tier.tag}</span>
                      )}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-center text-muted-foreground -mt-1">
                  Free US shipping · ships in 3–5 days
                </p>

                {/* PRIMARY CTA */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3.5 rounded-xl font-bold text-sm btn-gradient shadow-glow flex items-center justify-center gap-2 disabled:opacity-50"
                  onClick={handleBuyNow}
                  disabled={isCreatingOrder || !canBuy}
                >
                  {isCreatingOrder ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Setting up…
                    </>
                  ) : !canBuy ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {sheetVariant === "pack" ? "Building your pack…" : "Composing your sheet…"}
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={16} />
                      Buy Now — {formatPrice(selectedTier.priceCents)}
                    </>
                  )}
                </motion.button>

                {/* iPhone sticker pack — email-gated */}
                <IPhoneStickerPack
                  originalImage={generatedImage}
                  variations={variations}
                />

                {/* Try another style */}
                <button
                  className="text-sm text-primary font-semibold text-center flex items-center justify-center gap-1.5 py-1"
                  onClick={handleTryAnotherStyle}
                >
                  <Palette size={14} />
                  Try Another Style
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Order / Checkout */}
          {step === "order" && (
            <motion.div key="order" variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: "easeOut" }}>
              {paymentComplete ? (
                <OrderConfirmation
                  imageUrl={generatedImage || cartItems[0]?.generatedImage || ""}
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
                    cartItems={cartItems}
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
      </div>
    </main>
  );
}
