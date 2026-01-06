"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, RotateCcw, ShoppingCart, Download, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import StickerPreview from "@/components/StickerPreview"
import { STYLE_PRESETS, StylePresetKey, PRICING } from "@/lib/constants"

export default function PreviewPage() {
  const router = useRouter()
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<StylePresetKey | null>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [hasUsedRegenerate, setHasUsedRegenerate] = useState(false)

  useEffect(() => {
    const storedOriginal = sessionStorage.getItem("uploadedImage")
    const storedGenerated = sessionStorage.getItem("generatedImage")
    const storedStyle = sessionStorage.getItem("selectedStyle") as StylePresetKey

    if (!storedGenerated || !storedOriginal) {
      router.push("/")
      return
    }

    setOriginalImage(storedOriginal)
    setGeneratedImage(storedGenerated)
    setSelectedStyle(storedStyle)
  }, [router])

  const handleRegenerate = () => {
    if (hasUsedRegenerate) {
      // Could show upgrade/payment prompt here
      alert("You've used your free regeneration. Order now or start over with a new photo.")
      return
    }
    setHasUsedRegenerate(true)
    router.push("/create")
  }

  const handleCheckout = async () => {
    if (!generatedImage || !selectedStyle) return

    setIsCheckingOut(true)

    try {
      // Get email (could use a modal here, but for MVP we'll use prompt)
      const email = prompt("Enter your email for order updates:")
      if (!email) {
        setIsCheckingOut(false)
        return
      }

      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: generatedImage,
          email,
          stylePreset: selectedStyle,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create checkout session")
      }

      const { url } = await response.json()

      // Redirect to Stripe Checkout
      window.location.href = url
    } catch (error) {
      console.error("Checkout error:", error)
      alert("Failed to start checkout. Please try again.")
      setIsCheckingOut(false)
    }
  }

  const handleDownload = async () => {
    if (!generatedImage) return

    try {
      const response = await fetch(generatedImage)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `mesticker-${selectedStyle}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Download error:", error)
      window.open(generatedImage, "_blank")
    }
  }

  const handleBack = () => {
    router.push("/create")
  }

  if (!originalImage || !generatedImage || !selectedStyle) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

  const styleName = STYLE_PRESETS[selectedStyle]?.name || "Custom"
  const priceDisplay = (PRICING.totalPriceCents / 100).toFixed(2)

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Your Sticker</h1>
            <p className="text-sm text-gray-500">Preview and order</p>
          </div>
          <Badge className="bg-gradient-to-r from-green-400 to-emerald-400 text-white border-0">
            <Sparkles className="w-3 h-3 mr-1" />
            Ready!
          </Badge>
        </div>

        {/* Sticker Preview */}
        <StickerPreview
          originalImage={originalImage}
          stickerImage={generatedImage}
          styleName={styleName}
        />

        {/* Action Buttons */}
        <div className="mt-8 space-y-3">
          {/* Order Button */}
          <button
            onClick={handleCheckout}
            disabled={isCheckingOut}
            className="w-full pill-button pill-button-primary"
          >
            {isCheckingOut ? (
              <>
                <div className="loading-spinner" />
                Processing...
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Order Sticker - ${priceDisplay}
              </>
            )}
          </button>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              className="pill-button pill-button-secondary"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={handleRegenerate}
              className="pill-button pill-button-secondary"
              disabled={hasUsedRegenerate}
            >
              <RotateCcw className="w-4 h-4" />
              {hasUsedRegenerate ? "Used" : "Try Again"}
            </button>
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div className="mt-8 p-4 bg-gray-50 rounded-xl">
          <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">3" x 3" Die-Cut Sticker</span>
              <span className="font-medium">${(PRICING.stickerPriceCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Shipping (US)</span>
              <span className="font-medium">${(PRICING.shippingPriceCents / 100).toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-[#00C2FF]">${priceDisplay}</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <p className="mt-4 text-center text-xs text-gray-500">
          Secure checkout powered by Stripe • Ships in 5-7 business days
        </p>
      </div>
    </div>
  )
}
