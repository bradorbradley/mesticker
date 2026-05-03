"use client";

import { useState, useCallback, useEffect } from "react";
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
  Wand2,
  Palette,
  Loader2,
  Layers,
  Square,
} from "lucide-react";
import {
  INDIVIDUAL_PACK_TIERS,
  SHEET_TIERS,
  formatPrice,
  type ProductType,
} from "@/lib/pricing";
import LandingHero from "@/components/landing-hero";
import CameraCapture from "@/components/camera-capture";
import StyleGrid from "@/components/style-grid";
import LoadingState from "@/components/loading-state";
import ImageRevealSlider from "@/components/image-reveal";
import VariationsGrid from "@/components/variations-grid";
import UnifiedCheckout from "@/components/unified-checkout";
import OrderConfirmation from "@/components/order-confirmation";
import Gallery from "@/components/gallery";
import UserMenu from "@/components/user-menu";
import { useCreations } from "@/hooks/use-creations";
import { hapticMedium, hapticSuccess } from "@/lib/haptics";
import { getSessionId } from "@/lib/session";
import { resolvePresetPrompt } from "@/lib/presets";
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
  trackVariationsClicked,
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
  try {
    return parseInt(localStorage.getItem(GEN_COUNT_KEY) || "0", 10);
  } catch {
    return 0;
  }
}
function incrementLocalGenCount() {
  try {
    localStorage.setItem(GEN_COUNT_KEY, String(getLocalGenCount() + 1));
  } catch {}
}
function getLocalHasPurchased(): boolean {
  try {
    return localStorage.getItem(HAS_PURCHASED_KEY) === "true";
  } catch {
    return false;
  }
}
function setLocalHasPurchased() {
  try {
    localStorage.setItem(HAS_PURCHASED_KEY, "true");
  } catch {}
}
function getEmailCaptured(): boolean {
  try {
    return localStorage.getItem(EMAIL_CAPTURED_KEY) === "true";
  } catch {
    return false;
  }
}
function setEmailCaptured() {
  try {
    localStorage.setItem(EMAIL_CAPTURED_KEY, "true");
  } catch {}
}
function getEffectiveLimit(): number {
  return FREE_GENERATION_LIMIT + (getEmailCaptured() ? EMAIL_BONUS_LIMIT : 0);
}

const pageVariants = {
  enter: { opacity: 0, y: 20, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.98 },
};

export default function Home() {
  const { data: session } = useSession();
  const [showLanding, setShowLanding] = useState(true);
  const [step, setStep] = useState<AppStep>("capture");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | null>(null);
  const [activeStylePrompt, setActiveStylePrompt] = useState<string>("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Order state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState(0);
  const [orderQuantity, setOrderQuantity] = useState(0);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Cart items for order
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // Product picker state on reveal screen
  const [selectedProductType, setSelectedProductType] =
    useState<ProductType>("individual-pack");
  const [selectedTierId, setSelectedTierId] = useState<string>("ind-10");

  // Pre-fetched variations (kicked off in background after first generation)
  const [prefetchedVariations, setPrefetchedVariations] = useState<unknown[] | null>(
    null
  );
  const [variationsFetching, setVariationsFetching] = useState(false);

  // Generation limit
  const [limitReached, setLimitReached] = useState(false);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [serverHasPurchased, setServerHasPurchased] = useState(false);

  // Creations
  const { creations: localCreations, addCreation: addLocalCreation } =
    useCreations();
  const [dbCreations, setDbCreations] = useState<Creation[]>([]);

  const isSignedIn = !!session?.user;
  const displayCreations = isSignedIn ? dbCreations : localCreations;

  // Init session ID on mount
  useEffect(() => {
    getSessionId();
  }, []);

  // Check if user has seen landing
  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_LANDING_KEY) === "true") {
        setShowLanding(false);
      }
    } catch {}
  }, []);

  // Check purchase status
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

  // Load DB creations
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/creations")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDbCreations)
      .catch(() => {});
  }, [isSignedIn]);

  // Handle Stripe redirect return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("payment") === "success" ||
      params.get("redirect_status") === "succeeded"
    ) {
      setPaymentComplete(true);
      setStep("order");
      setShowLanding(false);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleLandingStart = useCallback(() => {
    setShowLanding(false);
    try {
      localStorage.setItem(SEEN_LANDING_KEY, "true");
    } catch {}
  }, []);

  const handleCapture = useCallback((imageBase64: string) => {
    setCapturedImage(imageBase64);
    setStep("style");
    trackCapture();
  }, []);

  // Style selection triggers generation immediately (no separate button)
  const handleStyleSelect = useCallback(
    async (preset: StylePreset, customPrompt?: string) => {
      if (!capturedImage) return;

      // Enforce generation limit
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
      setLimitReached(false);
      hapticMedium();

      const styleId = preset.id;
      trackGenerateStart(styleId);

      try {
        const body: Record<string, string> = { image: capturedImage };

        if (customPrompt) {
          body.customPrompt = customPrompt;
        } else {
          body.styleId = styleId;
        }

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

        // Store the resolved prompt for variations
        if (customPrompt) {
          setActiveStylePrompt(
            `${customPrompt}. Sticker-ready with a clean outline edge and transparent background. Keep the person's face fully recognizable.`
          );
        } else {
          const { prompt } = resolvePresetPrompt(data.stylePreset || styleId);
          setActiveStylePrompt(prompt);
        }

        incrementLocalGenCount();
        trackGenerateComplete(data.stylePreset || styleId);
        hapticSuccess();

        // Save creation
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

        // Move to reveal screen
        setStep("reveal");
        trackRevealViewed();
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : "Something went wrong";
        setGenerateError(errMsg);
        trackGenerateError(errMsg);
      } finally {
        setIsGenerating(false);
      }
    },
    [capturedImage, addLocalCreation, isSignedIn, serverHasPurchased]
  );

  // Reveal screen — buy the currently-selected product+tier
  const handleBuyNow = useCallback(async () => {
    if (!generatedImage || !capturedImage) return;
    trackOrderClicked();
    trackProductTypeSelected(selectedProductType);

    const newCartItems: CartItem[] = [
      {
        id: `item-${Date.now()}`,
        generatedImage,
        originalImage: capturedImage,
        stylePreset: selectedStyle?.id || "unknown",
        productType: selectedProductType,
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
            productType: i.productType,
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
      // orderQuantity = the qty from the chosen tier
      const tier =
        selectedProductType === "individual-pack"
          ? INDIVIDUAL_PACK_TIERS.find((t) => t.id === selectedTierId)
          : SHEET_TIERS.find((t) => t.id === selectedTierId);
      setOrderQuantity(tier?.qty ?? 1);
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setIsCreatingOrder(false);
    }
    setStep("order");
  }, [generatedImage, capturedImage, selectedStyle, selectedProductType, selectedTierId]);

  const handleCreateVariations = useCallback(() => {
    trackVariationsClicked();
    setStep("variations");
  }, []);

  const handleTryAnotherStyle = useCallback(() => {
    trackTryAnotherClicked();
    setGeneratedImage(null);
    setSelectedStyle(null);
    setGenerateError(null);
    // Keep capturedImage — no re-upload needed
    setStep("style");
  }, []);

  // Variations -> Order variation sheet (receives single composed sheet image + qty tier)
  const handleOrderVarietyPack = useCallback(
    async (composedImage: string, sheetTierId: string = "sheet-1") => {
      if (!capturedImage) return;
      trackProductTypeSelected("sticker-sheet");

      const newCartItems: CartItem[] = [
        {
          id: `item-${Date.now()}`,
          generatedImage: composedImage,
          originalImage: capturedImage,
          stylePreset: selectedStyle?.id || "unknown",
          productType: "sticker-sheet",
          tierId: sheetTierId,
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
              productType: i.productType,
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
        const tier = SHEET_TIERS.find((t) => t.id === sheetTierId);
        setOrderQuantity(tier?.qty ?? 1);
      } catch (error) {
        setPaymentError(
          error instanceof Error ? error.message : "Something went wrong"
        );
      } finally {
        setIsCreatingOrder(false);
      }
      setStep("order");
    },
    [capturedImage, selectedStyle]
  );

  // Background pre-fetch of variations as soon as first generation succeeds.
  // When the user clicks "See Variations" later, the data is already there.
  useEffect(() => {
    if (!generatedImage || !capturedImage || !activeStylePrompt) return;
    if (prefetchedVariations || variationsFetching) return;

    setVariationsFetching(true);
    fetch("/api/variations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: capturedImage,
        stylePrompt: activeStylePrompt,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.variations) setPrefetchedVariations(data.variations);
      })
      .catch(() => {})
      .finally(() => setVariationsFetching(false));
  }, [
    generatedImage,
    capturedImage,
    activeStylePrompt,
    prefetchedVariations,
    variationsFetching,
  ]);

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
    setActiveStylePrompt("");
    setClientSecret(null);
    setPaymentIntentId(null);
    setOrderAmount(0);
    setOrderQuantity(0);
    setPaymentComplete(false);
    setPaymentError(null);
    setGenerateError(null);
    setCartItems([]);
    setPrefetchedVariations(null);
    setVariationsFetching(false);
    setSelectedProductType("individual-pack");
    setSelectedTierId("ind-10");
    setStep("capture");
  }, []);

  const handleGallerySelect = useCallback((creation: Creation) => {
    setCapturedImage(creation.originalImage);
    setGeneratedImage(creation.generatedImage);
    setSelectedStyle(null);
    setClientSecret(null);
    setPaymentError(null);
    setPaymentComplete(false);
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
      // Back to style grid with photo cached
      setGeneratedImage(null);
      setSelectedStyle(null);
      setStep("style");
    } else if (step === "variations") {
      setStep("reveal");
    } else if (step === "order") {
      setClientSecret(null);
      setPaymentIntentId(null);
      setPaymentError(null);
      if (generatedImage) {
        setStep("reveal");
      } else {
        setStep("style");
      }
    }
  }, [step, generatedImage]);

  // Landing
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
            onClick={() => {
              setShowLanding(true);
              handleNewSticker();
            }}
            className="font-display text-xl font-bold gradient-text"
          >
            MeSticker
          </button>
          <UserMenu />
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {/* Step 1: Capture */}
          {step === "capture" && (
            <motion.div
              key="capture"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <CameraCapture onCapture={handleCapture} />
              <Gallery
                creations={displayCreations}
                onSelect={handleGallerySelect}
                className="mt-6"
              />
            </motion.div>
          )}

          {/* Step 2: Style Grid */}
          {step === "style" && (
            <motion.div
              key="style"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {isGenerating ? (
                <LoadingState photo={capturedImage} />
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Photo thumbnail + retake */}
                  {capturedImage && (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shadow-card border-2 border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={capturedImage}
                          alt="Your photo"
                          className="w-full h-full object-cover"
                        />
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

                  <h2 className="font-display text-lg font-bold text-center">
                    Tap a style to generate
                  </h2>

                  {generateError && (
                    <p className="text-sm text-red-500 text-center">
                      {generateError}
                    </p>
                  )}

                  {showEmailCapture ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center"
                    >
                      <Sparkles
                        size={24}
                        className="mx-auto mb-2 text-primary"
                      />
                      <p className="font-bold text-sm">
                        Want 1 more free generation?
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 mb-3">
                        Drop your email and we&apos;ll unlock one more!
                      </p>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (emailInput.includes("@")) {
                            try {
                              await fetch("/api/email-capture", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
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
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          type="submit"
                          className="px-4 py-2 rounded-xl font-bold text-sm btn-gradient shadow-glow"
                        >
                          Unlock
                        </motion.button>
                      </form>
                    </motion.div>
                  ) : limitReached ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-accent-orange/30 bg-accent-orange/5 p-5 text-center"
                    >
                      <Lock
                        size={24}
                        className="mx-auto mb-2 text-accent-orange"
                      />
                      <p className="font-bold text-sm">
                        Free generations used up
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Order any sticker to unlock unlimited creations!
                      </p>
                    </motion.div>
                  ) : (
                    <StyleGrid
                      onSelect={handleStyleSelect}
                      disabled={isGenerating}
                    />
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3: Reveal Screen */}
          {step === "reveal" && generatedImage && capturedImage && (
            <motion.div
              key="reveal"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="flex flex-col gap-3">
                <ImageRevealSlider
                  beforeSrc={capturedImage}
                  afterSrc={generatedImage}
                  height={280}
                />

                {/* Save & Share row */}
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
                    <Download size={16} />
                    Save
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
                          const file = new File([blob], "mesticker.png", {
                            type: "image/png",
                          });
                          await navigator.share({
                            title: "My MeSticker",
                            text: "Check out my cartoon sticker from mesticker.fun!",
                            files: [file],
                          });
                        } catch {}
                      } else {
                        window.open(
                          `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                            "Check out my cartoon sticker from mesticker.fun!"
                          )}`,
                          "_blank"
                        );
                      }
                    }}
                  >
                    <Share2 size={16} />
                    Share
                  </motion.button>
                </div>

                {/* Product picker — Individual vs Sheet */}
                <div className="rounded-2xl border border-border bg-card/50 p-3 flex flex-col gap-3">
                  {/* Product type tabs */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSelectedProductType("individual-pack");
                        setSelectedTierId("ind-10");
                      }}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all ${
                        selectedProductType === "individual-pack"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background"
                      }`}
                    >
                      <Square
                        size={18}
                        className={
                          selectedProductType === "individual-pack"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }
                      />
                      <span className="text-[11px] font-bold leading-tight">
                        Individual Stickers
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        3&quot; × 3&quot; kiss-cut
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProductType("sticker-sheet");
                        setSelectedTierId("sheet-1");
                      }}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all ${
                        selectedProductType === "sticker-sheet"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background"
                      }`}
                    >
                      <Layers
                        size={18}
                        className={
                          selectedProductType === "sticker-sheet"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }
                      />
                      <span className="text-[11px] font-bold leading-tight">
                        Sticker Sheet
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        6 stickers per sheet
                      </span>
                    </button>
                  </div>

                  {/* Tier selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {(selectedProductType === "individual-pack"
                      ? INDIVIDUAL_PACK_TIERS
                      : SHEET_TIERS
                    ).map((tier) => (
                      <button
                        key={tier.id}
                        onClick={() => setSelectedTierId(tier.id)}
                        className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 transition-all ${
                          selectedTierId === tier.id
                            ? "border-primary bg-primary/10 font-bold"
                            : "border-border bg-background"
                        }`}
                      >
                        <span className="text-[11px] font-bold leading-tight">
                          {tier.label}
                        </span>
                        <span className="text-[10px]">
                          {formatPrice(tier.priceCents)}
                        </span>
                        {"tag" in tier && tier.tag && (
                          <span className="text-[8px] text-primary font-bold mt-0.5">
                            {tier.tag}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PRIMARY CTA */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3.5 rounded-xl font-bold text-sm btn-gradient shadow-glow flex items-center justify-center gap-2"
                  onClick={handleBuyNow}
                  disabled={isCreatingOrder}
                >
                  {isCreatingOrder ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={16} />
                      Buy Now —{" "}
                      {formatPrice(
                        (selectedProductType === "individual-pack"
                          ? INDIVIDUAL_PACK_TIERS
                          : SHEET_TIERS
                        ).find((t) => t.id === selectedTierId)?.priceCents ?? 0
                      )}
                    </>
                  )}
                </motion.button>

                {/* SECONDARY CTA: Create Variations */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3 rounded-xl font-semibold text-sm glass-strong border-2 border-primary/30 shadow-soft flex items-center justify-center gap-2 relative overflow-hidden"
                  onClick={handleCreateVariations}
                >
                  <Wand2 size={14} />
                  See 6 Variations
                  {prefetchedVariations && (
                    <span className="absolute -top-0.5 right-3 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-b-md">
                      Ready!
                    </span>
                  )}
                  {variationsFetching && !prefetchedVariations && (
                    <span className="absolute -top-0.5 right-3 text-[9px] font-bold text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-b-md">
                      Loading...
                    </span>
                  )}
                </motion.button>

                {/* TERTIARY CTA */}
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

          {/* Step 4: Variations */}
          {step === "variations" && capturedImage && (
            <motion.div
              key="variations"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <VariationsGrid
                originalImage={capturedImage}
                stylePrompt={activeStylePrompt}
                prefetched={
                  prefetchedVariations as
                    | {
                        index: number;
                        image: string | null;
                        latency: number;
                        variation: string;
                        error?: string;
                      }[]
                    | null
                }
                onOrderVarietyPack={handleOrderVarietyPack}
                onTryAnotherStyle={handleTryAnotherStyle}
              />
            </motion.div>
          )}

          {/* Step 5: Order / Checkout */}
          {step === "order" && (
            <motion.div
              key="order"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
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
                  {paymentError && (
                    <p className="text-sm text-red-500 text-center mb-4">
                      {paymentError}
                    </p>
                  )}
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
                  {paymentError && (
                    <p className="text-sm text-red-500 mb-4">{paymentError}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Something went wrong. Please go back and try again.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
