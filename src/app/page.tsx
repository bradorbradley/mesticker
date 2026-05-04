"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
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
  Sparkles,
  Lock,
} from "lucide-react";
import { formatPrice } from "@/lib/pricing";
import { useCart, FIRST_SHEET_CENTS, ADDITIONAL_SHEET_CENTS } from "@/lib/cart";
import { composeSheetClient } from "@/lib/compose-sheet-client";
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
import { stylePresets } from "@/lib/presets";
import type { AppStep, StylePreset, Creation } from "@/types";
import {
  trackCapture,
  trackGenerateStart,
  trackGenerateComplete,
  trackGenerateError,
  trackCheckoutStart,
  trackPaymentComplete,
  trackImageDownload,
  trackImageShare,
  trackRevealViewed,
  trackTryAnotherClicked,
  trackProductTypeSelected,
} from "@/lib/analytics";

const GEN_COUNT_KEY = "mesticker-gen-count";
const HAS_PURCHASED_KEY = "mesticker-has-purchased";
const SEEN_LANDING_KEY = "mesticker-seen-landing";

function incrementLocalGenCount() {
  try {
    const current = parseInt(localStorage.getItem(GEN_COUNT_KEY) || "0", 10);
    localStorage.setItem(GEN_COUNT_KEY, String(current + 1));
  } catch {}
}
function getLocalHasPurchased() { try { return localStorage.getItem(HAS_PURCHASED_KEY) === "true"; } catch { return false; } }
function setLocalHasPurchased() { try { localStorage.setItem(HAS_PURCHASED_KEY, "true"); } catch {} }

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
  const [originalSheet, setOriginalSheet] = useState<string | null>(null); // 6-of-original sheet, pre-composed
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

  // Server-side purchase status (for returning-user detection)
  const [serverHasPurchased, setServerHasPurchased] = useState(false);

  // Creations
  const { creations: localCreations, addCreation: addLocalCreation } = useCreations();
  const [dbCreations, setDbCreations] = useState<Creation[]>([]);

  const isSignedIn = !!session?.user;
  const displayCreations = isSignedIn ? dbCreations : localCreations;

  // First-time vs returning user. Returning users get the multi-style picker;
  // first-timers go straight to Chibi for the fastest path to delight.
  const isReturningUser = useMemo(() => {
    if (typeof window === "undefined") return false;
    const hasLocalCreations = localCreations.length > 0;
    const hasPurchased = getLocalHasPurchased() || serverHasPurchased;
    return hasLocalCreations || hasPurchased;
  }, [localCreations.length, serverHasPurchased]);

  // Pre-composed sheets for each variation tile so tile-tap is instant
  const [tileSheets, setTileSheets] = useState<Record<number, string>>({});
  // Pack composition error state — surfaces if Canvas compose fails
  const [packError, setPackError] = useState<string | null>(null);

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

  const handleStyleSelect = useCallback(
    async (preset: StylePreset, customPrompt?: string, imageOverride?: string) => {
      const imageToUse = imageOverride ?? capturedImage;
      if (!imageToUse) return;

      setSelectedStyle(preset);
      setIsGenerating(true);
      setGenerateError(null);
      setGeneratedImage(null);
      setVariations([]);
      setPackSheet(null);
      setTileSheets({});
      setStep("style");
      hapticMedium();

      const styleId = preset.id;
      trackGenerateStart(styleId);

      try {
        const body: Record<string, string> = { image: imageToUse };
        if (customPrompt) body.customPrompt = customPrompt;
        else body.styleId = styleId;

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          if (data.error === "PROMPT_REJECTED") { setGenerateError("That style description wasn't allowed. Try something different!"); setIsGenerating(false); return; }
          throw new Error(data.error || "Generation failed");
        }

        const data = await res.json();
        setGeneratedImage(data.generatedImage);
        incrementLocalGenCount();
        trackGenerateComplete(data.stylePreset || styleId);
        hapticSuccess();

        addLocalCreation({
          originalImage: imageToUse,
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
                originalImage: imageToUse,
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
    [capturedImage, addLocalCreation, isSignedIn]
  );

  // Chibi-first auto-gen: snap photo → straight to Chibi for first-timers.
  // Returning users see the style grid (they've earned it).
  const handleCapture = useCallback(
    (imageBase64: string) => {
      setCapturedImage(imageBase64);
      trackCapture();

      if (isReturningUser) {
        setStep("style");
      } else {
        const chibi = stylePresets.find((p) => p.id === "chibi");
        if (chibi) {
          handleStyleSelect(chibi, undefined, imageBase64);
        } else {
          setStep("style");
        }
      }
    },
    [isReturningUser, handleStyleSelect]
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

  // When 6+ variations land, compose the Pack sheet client-side via Canvas.
  // Runs in the browser in <100ms — no serverless round-trip, no saturation.
  useEffect(() => {
    if (packSheet) return;
    const successful = variations.filter((v) => v.image).map((v) => v.image!);
    if (successful.length < 6) return;

    let cancelled = false;
    composeSheetClient(successful.slice(0, 6))
      .then((composed) => {
        if (!cancelled) {
          setPackSheet(composed);
          setPackError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Pack compose failed:", err);
          setPackError(err instanceof Error ? err.message : "Pack compose failed");
        }
      });

    return () => { cancelled = true; };
  }, [variations, packSheet]);

  // Pre-compose the "original sticker as a sheet of 6" the moment the cartoon
  // lands. Lets the user buy the original right from the reveal screen with
  // zero wait.
  useEffect(() => {
    if (!generatedImage || originalSheet) return;
    let cancelled = false;
    composeSheetClient([generatedImage], 6)
      .then((composed) => { if (!cancelled) setOriginalSheet(composed); })
      .catch((err) => console.error("Original sheet compose failed:", err));
    return () => { cancelled = true; };
  }, [generatedImage, originalSheet]);

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

  const addOriginalToCart = useCallback(() => {
    if (!originalSheet || !generatedImage) return;
    cart.addItem({
      kind: "single",
      composedImage: originalSheet,
      thumbnail: generatedImage,
      label: "Sheet of your original sticker — 6 of this design",
    });
    trackProductTypeSelected("single");
    hapticSuccess();
  }, [cart, originalSheet, generatedImage]);

  const addSingleTileToCart = useCallback(
    async (tileImage: string, idx: number) => {
      // Use pre-composed sheet if cached
      const cached = tileSheets[idx];
      if (cached) {
        cart.addItem({
          kind: "single",
          composedImage: cached,
          thumbnail: tileImage,
          label: "Sheet of one design — 6 of this sticker",
        });
        trackProductTypeSelected("single");
        hapticSuccess();
        return;
      }

      // Compose on the fly client-side (fast — <100ms via Canvas)
      setComposingTileIdx(idx);
      try {
        const composed = await composeSheetClient([tileImage], 6);
        setTileSheets((prev) => ({ ...prev, [idx]: composed }));
        cart.addItem({
          kind: "single",
          composedImage: composed,
          thumbnail: tileImage,
          label: "Sheet of one design — 6 of this sticker",
        });
        trackProductTypeSelected("single");
        hapticSuccess();
      } catch (err) {
        console.error("Tile compose failed:", err);
      } finally {
        setComposingTileIdx(null);
      }
    },
    [cart, tileSheets]
  );

  // INLINE CHECKOUT: auto-create the PaymentIntent the first time the user
  // adds anything to the cart, and PATCH it whenever the cart changes.
  // This makes Apple Pay / Google Pay / Link / Card buttons render right
  // on the reveal screen — no separate checkout page tap.
  const cartItemsKey = useMemo(
    () => cart.items.map((i) => `${i.kind}:${i.id}`).join("|"),
    [cart.items]
  );
  const cartTotalCentsKey = cart.totalCents;
  const cartCount = cart.count;

  // Create PI on first add
  useEffect(() => {
    if (cartCount === 0) return;
    if (clientSecret || paymentIntentId) return; // already exists
    if (isCreatingOrder) return;

    setIsCreatingOrder(true);
    setPaymentError(null);
    fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.items.map((i) => ({
          generatedImage: i.composedImage,
          stylePreset: selectedStyle?.id || "unknown",
          sheetVariant: i.kind === "variations" ? "pack" : "stack",
          tierId: "sheet-1",
        })),
        totalCents: cart.totalCents,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Order creation failed"))))
      .then((data) => {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setOrderAmount(data.amount);
        setOrderQuantity(cart.items.length);
        trackCheckoutStart();
      })
      .catch((err) => {
        setPaymentError(err instanceof Error ? err.message : "Checkout setup failed");
      })
      .finally(() => setIsCreatingOrder(false));
    // intentionally only depends on cartCount transition + clientSecret
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartCount, clientSecret, paymentIntentId, isCreatingOrder]);

  // PATCH PI when cart changes (after PI exists)
  useEffect(() => {
    if (!paymentIntentId || cartCount === 0) return;
    // Skip the initial set (PI was just created with this cart)
    const controller = new AbortController();
    fetch("/api/order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId,
        totalCents: cart.totalCents,
        items: cart.items.map((i) => ({
          generatedImage: i.composedImage,
          stylePreset: selectedStyle?.id || "unknown",
          sheetVariant: i.kind === "variations" ? "pack" : "stack",
          tierId: "sheet-1",
        })),
      }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.amount) {
          setOrderAmount(data.amount);
          setOrderQuantity(cart.items.length);
        }
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItemsKey, cartTotalCentsKey, paymentIntentId]);

  const handleTryAnotherStyle = useCallback(() => {
    trackTryAnotherClicked();
    setGeneratedImage(null);
    setSelectedStyle(null);
    setGenerateError(null);
    setVariations([]);
    setPackSheet(null);
    setOriginalSheet(null);
    setTileSheets({});
    setStep("style");
  }, []);

  const handlePaymentSuccess = useCallback(() => {
    setPaymentComplete(true);
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
    setOriginalSheet(null);
    setTileSheets({});
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
    setOriginalSheet(null);
    setTileSheets({});
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
      setOriginalSheet(null);
      setTileSheets({});
      setStep("style");
    } else if (step === "variations") {
      // Back from variations returns to reveal — cart preserved
      setStep("reveal");
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

                  <StyleGrid onSelect={handleStyleSelect} disabled={isGenerating} />
                </div>
              )}
            </motion.div>
          )}

          {step === "reveal" && generatedImage && capturedImage && (() => {
            const variationsReadyCount = variations.filter((v) => v.image).length;
            const originalInCart = !!cart.items.find(
              (it) => it.kind === "single" && it.thumbnail === generatedImage
            );
            const originalCartItem = cart.items.find(
              (it) => it.kind === "single" && it.thumbnail === generatedImage
            );
            return (
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

                  {/* THIS STICKER — toggle to add a sheet of 6 originals */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (originalInCart && originalCartItem) {
                        cart.removeItem(originalCartItem.id);
                        hapticLight();
                      } else {
                        addOriginalToCart();
                      }
                    }}
                    disabled={!originalSheet}
                    className={`w-full p-3 rounded-2xl border-2 transition-all flex items-center gap-3 disabled:opacity-50 ${
                      originalInCart
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                        : "border-border bg-card/50"
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={generatedImage} alt="" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-bold truncate">
                        Get this sticker — {formatPrice(FIRST_SHEET_CENTS)}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Sheet of 6 of this exact design · free US shipping
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {originalInCart ? (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md">
                          <Check size={16} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                          <Plus size={16} className="text-primary" />
                        </div>
                      )}
                    </div>
                  </motion.button>

                  {/* INLINE CHECKOUT — appears the moment cart has items */}
                  {cart.count === 0 ? (
                    <div className="w-full py-3 rounded-xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <ShoppingCart size={14} /> Add a sticker above to check out
                    </div>
                  ) : paymentComplete ? (
                    <OrderConfirmation
                      imageUrl={generatedImage || ""}
                      quantity={orderQuantity}
                      onNewSticker={handleNewSticker}
                    />
                  ) : isCreatingOrder && !clientSecret ? (
                    <div className="w-full py-6 rounded-xl border border-border bg-card/50 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" /> Loading checkout…
                    </div>
                  ) : clientSecret && paymentIntentId ? (
                    <div className="rounded-2xl border border-border bg-card/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                          <Lock size={12} /> Pay {formatPrice(cart.totalCents)}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {cart.count} {cart.count === 1 ? "sheet" : "sheets"} · free US shipping
                        </span>
                      </div>
                      {paymentError && (
                        <p className="text-xs text-red-500 text-center mb-2">{paymentError}</p>
                      )}
                      <UnifiedCheckout
                        clientSecret={clientSecret}
                        paymentIntentId={paymentIntentId}
                        amount={orderAmount}
                        cartItems={cart.items.map((i) => ({
                          id: i.id,
                          generatedImage: i.composedImage,
                          originalImage: capturedImage || "",
                          stylePreset: selectedStyle?.id || "unknown",
                          sheetVariant: i.kind === "variations" ? ("pack" as const) : ("stack" as const),
                          tierId: "sheet-1",
                        }))}
                        onSuccess={handlePaymentSuccess}
                        onError={setPaymentError}
                        compact
                      />
                    </div>
                  ) : (
                    <div className="w-full py-3 text-xs text-muted-foreground text-center">
                      {paymentError || "Setting up checkout..."}
                    </div>
                  )}

                  {/* View Variations — secondary CTA, takes user to the 9-grid */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStep("variations")}
                    className="w-full py-3 rounded-xl font-semibold text-sm glass-strong border-2 border-primary/30 shadow-soft flex items-center justify-center gap-2 relative"
                  >
                    <Sparkles size={14} className="text-primary" />
                    View 9 More Variations
                    {variationsReadyCount > 0 && variationsReadyCount < 9 && (
                      <span className="text-[10px] text-muted-foreground ml-1">({variationsReadyCount}/9 ready)</span>
                    )}
                    {variationsReadyCount >= 9 && (
                      <span className="absolute -top-0.5 right-3 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-b-md">
                        Ready
                      </span>
                    )}
                  </motion.button>

                  <IPhoneStickerPack originalImage={generatedImage} variations={variationsForIPhone} />

                  <button className="text-sm text-primary font-semibold text-center flex items-center justify-center gap-1.5 py-1" onClick={handleTryAnotherStyle}>
                    <Palette size={14} /> Try Another Style
                  </button>
                </div>
              </motion.div>
            );
          })()}

          {step === "variations" && generatedImage && capturedImage && (
            <motion.div key="variations" variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: "easeOut" }}>
              <div className="flex flex-col gap-4">
                <div className="text-center">
                  <h2 className="font-display text-lg font-bold">More variations of you</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tap any sticker to add a sheet of that design
                  </p>
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
                      const inCart = !!cart.items.find(
                        (it) => it.kind === "single" && it.thumbnail === v?.image
                      );
                      return (
                        <div key={i} className="relative">
                          {v?.image ? (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.3 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                hapticLight();
                                if (inCart) {
                                  const item = cart.items.find(
                                    (it) => it.kind === "single" && it.thumbnail === v.image
                                  );
                                  if (item) cart.removeItem(item.id);
                                } else {
                                  addSingleTileToCart(v.image!, i);
                                }
                              }}
                              disabled={composingTileIdx === i}
                              className={`relative w-full aspect-square rounded-xl overflow-hidden bg-muted/30 border-2 transition-colors disabled:opacity-60 ${
                                inCart ? "border-primary ring-2 ring-primary/30" : "border-border"
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={v.image} alt="" className="w-full h-full object-contain" />
                              <div className="absolute top-1 right-1">
                                {composingTileIdx === i ? (
                                  <div className="w-6 h-6 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
                                    <Loader2 size={12} className="animate-spin text-primary" />
                                  </div>
                                ) : inCart ? (
                                  <div className="w-6 h-6 rounded-full bg-primary shadow-lg flex items-center justify-center">
                                    <Check size={12} className="text-white" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
                                    <Plus size={12} className="text-primary" />
                                  </div>
                                )}
                              </div>
                            </motion.button>
                          ) : (
                            <SkeletonTile styleId={styleId} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Variations Pack — clear card with add/remove toggle */}
                {(() => {
                  const packInCart = !!cart.items.find((it) => it.kind === "variations");
                  const packItem = cart.items.find((it) => it.kind === "variations");
                  return (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (packError) {
                          setPackError(null);
                          setPackSheet(null);
                          return;
                        }
                        if (packInCart && packItem) {
                          cart.removeItem(packItem.id);
                          hapticLight();
                          return;
                        }
                        addPackToCart();
                      }}
                      disabled={!packSheet && !packError}
                      className={`w-full p-3 rounded-2xl border-2 transition-all flex items-center gap-3 disabled:opacity-50 ${
                        packInCart
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-border bg-card/50"
                      }`}
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center flex-shrink-0">
                        {packSheet ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={packSheet} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <Loader2 size={16} className="animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-bold truncate">
                          Variations Pack — {formatPrice(FIRST_SHEET_CENTS)}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {packError
                            ? "Couldn't build pack — tap to retry"
                            : !packSheet
                            ? "Building your pack…"
                            : "All 9 unique poses on one sheet"}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {packError ? (
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                            <Plus size={16} className="text-orange-600" />
                          </div>
                        ) : packInCart ? (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md">
                            <Check size={16} className="text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                            <Plus size={16} className="text-primary" />
                          </div>
                        )}
                      </div>
                    </motion.button>
                  );
                })()}

                {/* INLINE CHECKOUT — same as reveal, cart persists */}
                {cart.count === 0 ? (
                  <div className="w-full py-3 rounded-xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <ShoppingCart size={14} /> Pick a sticker above to check out
                  </div>
                ) : paymentComplete ? (
                  <OrderConfirmation
                    imageUrl={generatedImage || ""}
                    quantity={orderQuantity}
                    onNewSticker={handleNewSticker}
                  />
                ) : isCreatingOrder && !clientSecret ? (
                  <div className="w-full py-6 rounded-xl border border-border bg-card/50 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" /> Loading checkout…
                  </div>
                ) : clientSecret && paymentIntentId ? (
                  <div className="rounded-2xl border border-border bg-card/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Lock size={12} /> Pay {formatPrice(cart.totalCents)}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {cart.count} {cart.count === 1 ? "sheet" : "sheets"} · free US shipping
                      </span>
                    </div>
                    {paymentError && (
                      <p className="text-xs text-red-500 text-center mb-2">{paymentError}</p>
                    )}
                    <UnifiedCheckout
                      clientSecret={clientSecret}
                      paymentIntentId={paymentIntentId}
                      amount={orderAmount}
                      cartItems={cart.items.map((i) => ({
                        id: i.id,
                        generatedImage: i.composedImage,
                        originalImage: capturedImage || "",
                        stylePreset: selectedStyle?.id || "unknown",
                        sheetVariant: i.kind === "variations" ? ("pack" as const) : ("stack" as const),
                        tierId: "sheet-1",
                      }))}
                      onSuccess={handlePaymentSuccess}
                      onError={setPaymentError}
                      compact
                    />
                  </div>
                ) : (
                  <div className="w-full py-3 text-xs text-muted-foreground text-center">
                    {paymentError || "Setting up checkout..."}
                  </div>
                )}
                {cart.count > 1 && !paymentComplete && (
                  <p className="text-[10px] text-muted-foreground text-center -mt-2">
                    {formatPrice(FIRST_SHEET_CENTS)} first sheet · {formatPrice(ADDITIONAL_SHEET_CENTS)} each additional
                  </p>
                )}

                <button className="text-sm text-primary font-semibold text-center flex items-center justify-center gap-1.5 py-1" onClick={() => setStep("reveal")}>
                  <ArrowLeft size={14} /> Back to your sticker
                </button>
              </div>
            </motion.div>
          )}

          {/* Fallback: lands here only after a Stripe-hosted redirect with
              ?payment=success. Inline checkout on the reveal screen handles
              the normal Apple Pay / card flow without needing this step. */}
          {step === "order" && paymentComplete && (
            <motion.div key="order" variants={pageVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: "easeOut" }}>
              <OrderConfirmation
                imageUrl={generatedImage || ""}
                quantity={orderQuantity}
                onNewSticker={handleNewSticker}
              />
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
                      onClick={() => setShowCart(false)}
                      className="w-full py-3 rounded-xl font-bold text-sm btn-gradient shadow-glow flex items-center justify-center gap-2"
                    >
                      <Check size={14} />
                      Looks good — pay below
                    </motion.button>
                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                      Apple Pay & card on the main screen · free US shipping
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
