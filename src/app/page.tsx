"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProgressSteps from "@/components/progress-steps";
import CameraCapture from "@/components/camera-capture";
import StyleCarousel from "@/components/style-carousel";
import LoadingState from "@/components/loading-state";
import OrderForm from "@/components/order-form";
import PaymentForm from "@/components/payment-form";
import OrderConfirmation from "@/components/order-confirmation";
import ImageRevealSlider from "@/components/image-reveal";
import Gallery from "@/components/gallery";
import { useCreations } from "@/hooks/use-creations";
import type { AppStep, StylePreset, ShippingAddress } from "@/types";

const pageVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

export default function Home() {
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

  const { creations, addCreation } = useCreations();

  const handleCapture = useCallback((imageBase64: string) => {
    setCapturedImage(imageBase64);
    setStep("style");
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!capturedImage || !selectedStyle) return;

    setIsGenerating(true);
    setGenerateError(null);

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
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setGeneratedImage(data.generatedImage);

      addCreation({
        originalImage: capturedImage,
        generatedImage: data.generatedImage,
        stylePreset: selectedStyle.id,
        ordered: false,
      });
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [capturedImage, selectedStyle, addCreation]);

  const handleOrderSubmit = useCallback(
    async (quantity: number, address: ShippingAddress) => {
      if (!generatedImage) return;

      setIsCreatingOrder(true);
      setPaymentError(null);

      try {
        const res = await fetch("/api/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: generatedImage, quantity, address }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Order creation failed");
        }

        const data = await res.json();
        setClientSecret(data.clientSecret);
        setOrderAmount(data.amount);
        setOrderQuantity(quantity);
      } catch (error) {
        setPaymentError(
          error instanceof Error ? error.message : "Something went wrong"
        );
      } finally {
        setIsCreatingOrder(false);
      }
    },
    [generatedImage]
  );

  const handlePaymentSuccess = useCallback(() => {
    setPaymentComplete(true);
  }, []);

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

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {step !== "capture" && !paymentComplete ? (
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <div className="w-8" />
          )}
          <h1 className="text-xl font-bold text-primary">MeSticker</h1>
          <div className="w-8" />
        </div>

        {/* Progress */}
        {!paymentComplete && (
          <ProgressSteps current={step} className="mb-6" />
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
              transition={{ duration: 0.2 }}
            >
              <CameraCapture onCapture={handleCapture} />
              <Gallery creations={creations} className="mt-6" />
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
              transition={{ duration: 0.2 }}
            >
              {isGenerating ? (
                <LoadingState />
              ) : generatedImage && capturedImage ? (
                <div className="flex flex-col gap-4">
                  <ImageRevealSlider
                    beforeSrc={capturedImage}
                    afterSrc={generatedImage}
                    height={350}
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setGeneratedImage(null);
                        setSelectedStyle(null);
                      }}
                    >
                      Try Another Style
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => setStep("order")}
                    >
                      Order Stickers
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {capturedImage && (
                    <div className="w-full aspect-square rounded-2xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={capturedImage}
                        alt="Captured photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <h2 className="font-semibold mb-2">Choose a style</h2>
                    <StyleCarousel
                      selected={selectedStyle?.id ?? null}
                      onSelect={setSelectedStyle}
                    />
                  </div>
                  {generateError && (
                    <p className="text-sm text-red-500 text-center">
                      {generateError}
                    </p>
                  )}
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={!selectedStyle}
                    onClick={handleGenerate}
                  >
                    <Sparkles size={18} className="mr-2" />
                    Generate Sticker
                  </Button>
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
              transition={{ duration: 0.2 }}
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
                  {generatedImage && (
                    <div className="w-full rounded-2xl overflow-hidden mb-4 h-48 flex items-center justify-center bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={generatedImage}
                        alt="Your sticker"
                        className="h-full object-contain"
                      />
                    </div>
                  )}
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
