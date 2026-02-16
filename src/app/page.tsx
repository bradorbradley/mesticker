"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import LandingHero from "@/components/landing-hero";
import ProgressSteps from "@/components/progress-steps";
import CameraCapture from "@/components/camera-capture";
import StyleCarousel from "@/components/style-carousel";
import LoadingState from "@/components/loading-state";
import StickerReveal from "@/components/sticker-reveal";
import OrderForm from "@/components/order-form";
import PaymentForm from "@/components/payment-form";
import OrderConfirmation from "@/components/order-confirmation";
import ImageRevealSlider from "@/components/image-reveal";
import Gallery from "@/components/gallery";
import UserMenu from "@/components/user-menu";
import { useCreations } from "@/hooks/use-creations";
import { hapticMedium } from "@/lib/haptics";
import type { AppStep, StylePreset, ShippingAddress, CartItem, Creation } from "@/types";

const FREE_GENERATION_LIMIT = 3;
const GEN_COUNT_KEY = "mesticker-gen-count";
const HAS_PURCHASED_KEY = "mesticker-has-purchased";
const SEEN_LANDING_KEY = "mesticker-seen-landing";

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
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Order state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState(0);
  const [orderTotalSheets, setOrderTotalSheets] = useState(0);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Generation limit
  const [limitReached, setLimitReached] = useState(false);

  // Creations
  const { creations: localCreations, addCreation: addLocalCreation } =
    useCreations();
  const [dbCreations, setDbCreations] = useState<Creation[]>([]);

  const isSignedIn = !!session?.user;
  const displayCreations = isSignedIn ? dbCreations : localCreations;

  // Find the creation matching the currently generated image (for the order form)
  const currentCreation = useMemo(() => {
    if (!generatedImage) return null;
    return displayCreations.find((c) => c.generatedImage === generatedImage) || null;
  }, [generatedImage, displayCreations]);

  // Check if user has seen landing before
  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_LANDING_KEY) === "true") {
        setShowLanding(false);
      }
    } catch {}
  }, []);

  // Load creations from DB when signed in
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/creations")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDbCreations)
      .catch(() => {});
  }, [isSignedIn]);

  // Handle redirect return from Stripe
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
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!capturedImage || !selectedStyle) return;

    if (!isSignedIn) {
      const count = getLocalGenCount();
      const purchased = getLocalHasPurchased();
      if (count >= FREE_GENERATION_LIMIT && !purchased) {
        setLimitReached(true);
        return;
      }
    }

    setIsGenerating(true);
    setGenerateError(null);
    setLimitReached(false);
    hapticMedium();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: capturedImage,
          styleId: selectedStyle.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === "FREE_LIMIT_REACHED") {
          setLimitReached(true);
          return;
        }
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setGeneratedImage(data.generatedImage);
      incrementLocalGenCount();

      addLocalCreation({
        originalImage: capturedImage,
        generatedImage: data.generatedImage,
        imageUrl: data.imageUrl,
        stylePreset: selectedStyle.id,
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
              imageUrl: data.imageUrl,
              stylePreset: selectedStyle.id,
            }),
          });
          if (saveRes.ok) {
            const saved = await saveRes.json();
            setDbCreations((prev) => [saved, ...prev]);
          }
        } catch {
          // DB save failure is non-blocking
        }
      }
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [capturedImage, selectedStyle, addLocalCreation, isSignedIn]);

  const handleOrderSubmit = useCallback(
    async (items: CartItem[], address: ShippingAddress) => {
      if (items.length === 0) return;

      setIsCreatingOrder(true);
      setPaymentError(null);

      try {
        const res = await fetch("/api/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, address }),
        });

        if (!res.ok) {
          let errorMsg = "Order creation failed";
          try {
            const data = await res.json();
            errorMsg = data.error || errorMsg;
          } catch {
            // Response wasn't JSON (e.g. "Request Entity Too Large")
            const text = await res.text().catch(() => "");
            if (text) errorMsg = text;
          }
          throw new Error(errorMsg);
        }

        const data = await res.json();
        setClientSecret(data.clientSecret);
        setOrderAmount(data.amount);
        setOrderTotalSheets(items.reduce((sum, i) => sum + i.sheets, 0));
      } catch (error) {
        setPaymentError(
          error instanceof Error ? error.message : "Something went wrong"
        );
      } finally {
        setIsCreatingOrder(false);
      }
    },
    []
  );

  const handlePaymentSuccess = useCallback(() => {
    setPaymentComplete(true);
    setLimitReached(false);
    setLocalHasPurchased();
  }, []);

  const handleNewSticker = useCallback(() => {
    setCapturedImage(null);
    setSelectedStyle(null);
    setGeneratedImage(null);
    setClientSecret(null);
    setOrderAmount(0);
    setOrderTotalSheets(0);
    setPaymentComplete(false);
    setPaymentError(null);
    setGenerateError(null);
    setStep("capture");
  }, []);

  const handleGallerySelect = useCallback((creation: Creation) => {
    setCapturedImage(creation.originalImage);
    setGeneratedImage(creation.generatedImage);
    setSelectedStyle(null);
    setClientSecret(null);
    setPaymentError(null);
    setPaymentComplete(false);
    setStep("style");
  }, []);

  const goBack = useCallback(() => {
    if (step === "style") {
      setGeneratedImage(null);
      setSelectedStyle(null);
      setGenerateError(null);
      setStep("capture");
    } else if (step === "order") {
      setClientSecret(null);
      setPaymentError(null);
      setStep("style");
    }
  }, [step]);

  // Landing page
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
          <h1 className="font-display text-xl font-bold gradient-text">
            MeSticker
          </h1>
          <UserMenu />
        </div>

        {/* Progress */}
        {!paymentComplete && (
          <ProgressSteps current={step} className="mb-5" />
        )}

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

          {/* Step 2: Style */}
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
              ) : generatedImage && capturedImage ? (
                <div className="flex flex-col gap-4">
                  <StickerReveal imageUrl={generatedImage} />
                  <ImageRevealSlider
                    beforeSrc={capturedImage}
                    afterSrc={generatedImage}
                    height={280}
                  />
                  <div className="flex gap-3">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 py-3 rounded-xl font-semibold text-sm glass-strong border border-border shadow-soft"
                      onClick={() => {
                        setGeneratedImage(null);
                        setSelectedStyle(null);
                      }}
                    >
                      Try Another Style
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 py-3 rounded-xl font-bold text-sm btn-gradient shadow-glow"
                      onClick={() => setStep("order")}
                    >
                      Order Stickers
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {capturedImage && (
                    <div className="w-24 h-24 mx-auto rounded-2xl overflow-hidden shadow-card border-2 border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={capturedImage}
                        alt="Captured photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <h2 className="font-display text-lg font-bold text-center mb-3">
                      Choose your style
                    </h2>
                    <StyleCarousel
                      onActiveChange={setSelectedStyle}
                    />
                  </div>
                  {generateError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
                      <p className="text-sm text-red-600">
                        {generateError}
                      </p>
                      <button
                        onClick={() => {
                          setGenerateError(null);
                          handleGenerate();
                        }}
                        className="mt-2 text-xs font-semibold text-primary underline underline-offset-2"
                      >
                        Tap to retry
                      </button>
                    </div>
                  )}
                  {limitReached ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-accent-orange/30 bg-accent-orange/5 p-5 text-center"
                    >
                      <Lock size={24} className="mx-auto mb-2 text-accent-orange" />
                      <p className="font-bold text-sm">
                        Free generations used up
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Order any sticker to unlock unlimited creations!
                      </p>
                    </motion.div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleGenerate}
                      className="w-full py-4 rounded-2xl font-bold text-base btn-gradient shadow-glow flex items-center justify-center gap-2"
                    >
                      <Sparkles size={18} />
                      Generate Sticker
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3: Order */}
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
                  imageUrl={generatedImage || ""}
                  totalSheets={orderTotalSheets}
                  onNewSticker={handleNewSticker}
                />
              ) : clientSecret ? (
                <div>
                  {paymentError && (
                    <p className="text-sm text-red-500 text-center mb-4">
                      {paymentError}
                    </p>
                  )}
                  <PaymentForm
                    clientSecret={clientSecret}
                    amount={orderAmount}
                    onSuccess={handlePaymentSuccess}
                    onError={setPaymentError}
                  />
                </div>
              ) : (
                <div>
                  {paymentError && (
                    <p className="text-sm text-red-500 text-center mb-4">
                      {paymentError}
                    </p>
                  )}
                  <OrderForm
                    currentCreation={currentCreation}
                    pastCreations={displayCreations}
                    onSubmit={handleOrderSubmit}
                    isLoading={isCreatingOrder}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
