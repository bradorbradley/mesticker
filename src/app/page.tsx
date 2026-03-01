"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Lock, Sparkles, Download, Share2, Camera, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import LandingHero from "@/components/landing-hero";
import ProgressSteps from "@/components/progress-steps";
import CameraCapture from "@/components/camera-capture";
import StyleCarousel from "@/components/style-carousel";
import LoadingState from "@/components/loading-state";
import OrderForm from "@/components/order-form";
import PaymentForm from "@/components/payment-form";
import OrderConfirmation from "@/components/order-confirmation";
import ImageRevealSlider from "@/components/image-reveal";
import Gallery from "@/components/gallery";
import UserMenu from "@/components/user-menu";
import { useCreations } from "@/hooks/use-creations";
import { hapticMedium } from "@/lib/haptics";
import type { AppStep, StylePreset, ShippingAddress, Creation } from "@/types";
import {
  trackCapture,
  trackStyleSelect,
  trackGenerateStart,
  trackGenerateComplete,
  trackGenerateError,
  trackAddToCart,
  trackCheckoutStart,
  trackPaymentComplete,
  trackLimitReached,
  trackEmailCapture,
  trackImageDownload,
  trackImageShare,
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

  // Generation limit
  const [limitReached, setLimitReached] = useState(false);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [serverPurchaseChecked, setServerPurchaseChecked] = useState(false);
  const [serverHasPurchased, setServerHasPurchased] = useState(false);

  // Creations
  const { creations: localCreations, addCreation: addLocalCreation } =
    useCreations();
  const [dbCreations, setDbCreations] = useState<Creation[]>([]);

  const isSignedIn = !!session?.user;
  const displayCreations = isSignedIn ? dbCreations : localCreations;
  const cart = useCart();

  // Check if user has seen landing before
  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_LANDING_KEY) === "true") {
        setShowLanding(false);
      }
    } catch {}
  }, []);

  // Check purchase status from server when signed in
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
        setServerPurchaseChecked(true);
      })
      .catch(() => {
        setServerPurchaseChecked(true);
      });
  }, [isSignedIn]);

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
    trackCapture();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!capturedImage || !selectedStyle) return;

    // Enforce generation limit — skip if server confirmed purchase
    const count = getLocalGenCount();
    const purchased = getLocalHasPurchased() || serverHasPurchased;
    const limit = getEffectiveLimit();
    if (count >= limit && !purchased) {
      if (!getEmailCaptured() && count >= FREE_GENERATION_LIMIT) {
        // Show email capture for +1 bonus
        setShowEmailCapture(true);
        return;
      }
      setLimitReached(true);
      trackLimitReached();
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setLimitReached(false);
    hapticMedium();
    trackGenerateStart(selectedStyle.id);

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
      trackGenerateComplete(selectedStyle.id);

      addLocalCreation({
        originalImage: capturedImage,
        generatedImage: data.generatedImage,
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
      const errMsg = error instanceof Error ? error.message : "Something went wrong";
      setGenerateError(errMsg);
      trackGenerateError(errMsg);
    } finally {
      setIsGenerating(false);
    }
  }, [capturedImage, selectedStyle, addLocalCreation, isSignedIn, serverHasPurchased]);

  const handleOrderSubmit = useCallback(
    async (email: string, quantity: number, address: ShippingAddress) => {
      if (cart.items.length === 0) return;

      setIsCreatingOrder(true);
      setPaymentError(null);

      try {
        const res = await fetch("/api/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            items: cart.items.map((i) => ({
              generatedImage: i.generatedImage,
              sheets: i.sheets,
              stylePreset: i.stylePreset,
            })),
            address,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Order creation failed");
        }

        const data = await res.json();
        setClientSecret(data.clientSecret);
        setOrderAmount(data.amount);
        setOrderQuantity(cart.totalSheets);
      } catch (error) {
        setPaymentError(
          error instanceof Error ? error.message : "Something went wrong"
        );
      } finally {
        setIsCreatingOrder(false);
      }
    },
    [cart]
  );

  const handlePaymentSuccess = useCallback(() => {
    setPaymentComplete(true);
    setLimitReached(false);
    setLocalHasPurchased();
    trackPaymentComplete(orderAmount, orderQuantity);
    cart.clearCart();
  }, [cart, orderAmount, orderQuantity]);

  const handleNewSticker = useCallback(() => {
    setCapturedImage(null);
    setSelectedStyle(null);
    setGeneratedImage(null);
    setClientSecret(null);
    setOrderAmount(0);
    setOrderQuantity(0);
    setPaymentComplete(false);
    setPaymentError(null);
    setGenerateError(null);
    setStep("capture");
  }, []);

  const handleStyleSelect = useCallback((preset: StylePreset) => {
    setSelectedStyle(preset);
    trackStyleSelect(preset.id);
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
          <button
            onClick={() => {
              setShowLanding(true);
              setCapturedImage(null);
              setSelectedStyle(null);
              setGeneratedImage(null);
              setStep("capture");
            }}
            className="font-display text-xl font-bold gradient-text"
          >
            MeSticker
          </button>
          <UserMenu />
        </div>

        {/* Progress */}
        {!paymentComplete && (
          <ProgressSteps
            current={step}
            onStepClick={(s) => {
              if (s === "capture") {
                setGeneratedImage(null);
                setSelectedStyle(null);
                setGenerateError(null);
                setStep("capture");
              } else if (s === "style" && capturedImage) {
                setGeneratedImage(null);
                setClientSecret(null);
                setPaymentError(null);
                setStep("style");
              } else if (s === "order" && cart.items.length > 0) {
                setClientSecret(null);
                setPaymentError(null);
                setStep("order");
              }
            }}
            className="mb-5"
          />
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
                  <ImageRevealSlider
                    beforeSrc={capturedImage}
                    afterSrc={generatedImage}
                    height={280}
                  />
                  {/* Save & Share */}
                  <div className="flex gap-2 justify-center">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold glass-strong border border-border shadow-soft"
                      onClick={() => {
                        // Download as PNG
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
                            const file = new File([blob], "mesticker.png", { type: "image/png" });
                            await navigator.share({
                              title: "My MeSticker",
                              text: "Check out my cartoon sticker from mesticker.fun!",
                              files: [file],
                            });
                          } catch {}
                        } else {
                          window.open(
                            `https://twitter.com/intent/tweet?text=${encodeURIComponent("Check out my cartoon sticker from mesticker.fun! 🎨")}`,
                            "_blank"
                          );
                        }
                      }}
                    >
                      <Share2 size={16} />
                      Share
                    </motion.button>
                  </div>
                  {/* Order Stickers → adds to cart then checkout */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="w-full py-3 rounded-xl font-bold text-sm btn-gradient shadow-glow flex items-center justify-center gap-2"
                    onClick={() => {
                      if (!generatedImage || !capturedImage || !selectedStyle) return;
                      cart.addItem({
                        generatedImage,
                        originalImage: capturedImage,
                        stylePreset: selectedStyle.id,
                      });
                      hapticMedium();
                      trackAddToCart(selectedStyle.id);
                      trackCheckoutStart();
                      // Immediately set step to order - React will batch this with cart update
                      setStep("order");
                    }}
                  >
                    <ShoppingCart size={16} />
                    Order Stickers
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm glass-strong border border-border shadow-soft flex items-center justify-center gap-2"
                    onClick={() => {
                      if (generatedImage && capturedImage && selectedStyle) {
                        cart.addItem({
                          generatedImage,
                          originalImage: capturedImage,
                          stylePreset: selectedStyle.id,
                        });
                      }
                      setCapturedImage(null);
                      setSelectedStyle(null);
                      setGeneratedImage(null);
                      setGenerateError(null);
                      setStep("capture");
                    }}
                  >
                    <Camera size={14} />
                    Make Another Sticker First
                  </motion.button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {capturedImage && (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shadow-card border-2 border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={capturedImage}
                          alt="Captured photo"
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
                  <div>
                    <h2 className="font-display text-lg font-bold text-center mb-2">
                      Choose your style
                    </h2>
                    <StyleCarousel
                      onSelect={handleStyleSelect}
                    />
                  </div>
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
                      <Sparkles size={24} className="mx-auto mb-2 text-primary" />
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
                            // Send to backend
                            try {
                              await fetch("/api/email-capture", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ email: emailInput }),
                              });
                            } catch {} // Non-blocking
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
                      disabled={!selectedStyle}
                      onClick={handleGenerate}
                      className="w-full py-4 rounded-2xl font-bold text-base btn-gradient shadow-glow disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
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
                  quantity={orderQuantity}
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
