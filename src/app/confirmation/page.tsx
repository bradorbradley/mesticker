"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, Package, Mail, Home, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sessionId = searchParams.get("session_id")

    if (!sessionId) {
      setError("No order session found")
      setIsLoading(false)
      return
    }

    const generatedImage = sessionStorage.getItem("generatedImage")
    const selectedStyle = sessionStorage.getItem("selectedStyle")

    // DO NOT create a Printful order here — the Stripe webhook is the source
    // of truth. Just fetch/poll the order status that was created by the webhook.
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/order-status?session_id=${sessionId}`)
        const data = await response.json()

        setOrderDetails({
          orderId: data?.printful_order_id || "Processing...",
          estimatedDelivery: "5-7 business days",
          imageUrl: generatedImage,
          style: selectedStyle,
          status: data?.status || "pending",
        })
      } catch (err) {
        console.error("Order fetch error:", err)
        // Even if lookup fails, don't block the confirmation UX — payment succeeded
        setOrderDetails({
          orderId: "Processing...",
          estimatedDelivery: "5-7 business days",
          imageUrl: generatedImage,
          style: selectedStyle,
          status: "pending",
        })
      } finally {
        setIsLoading(false)
        sessionStorage.removeItem("uploadedImage")
        sessionStorage.removeItem("uploadedImageBase64")
        sessionStorage.removeItem("generatedImage")
        sessionStorage.removeItem("selectedStyle")
        sessionStorage.removeItem("generationId")
      }
    }

    fetchOrder()
  }, [searchParams])

  const handleNewOrder = () => {
    router.push("/")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-[#00C2FF] to-[#0EA5E9] rounded-2xl mx-auto flex items-center justify-center">
            <div className="loading-spinner" />
          </div>
          <p className="text-gray-600">Confirming your order...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 p-6">
          <div className="w-16 h-16 bg-red-100 rounded-2xl mx-auto flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
          <p className="text-gray-600">{error}</p>
          <button onClick={handleNewOrder} className="pill-button pill-button-primary">
            Start Over
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-[#FF7B36] to-[#6C63FF] rounded-full flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="title mb-2">Your Sticker Sheet is on the Way!</h1>
          <p className="subtitle">
            Thank you for your order. We're printing your custom sticker sheet now.
          </p>
        </div>

        {orderDetails?.imageUrl && (
          <div className="mb-8 flex justify-center">
            <div
              className="w-32 h-32 rounded-xl overflow-hidden shadow-lg border-4 border-white"
              style={{
                transform: "rotate(-3deg)",
                filter: "drop-shadow(4px 4px 8px rgba(0, 0, 0, 0.15))",
              }}
            >
              <img
                src={orderDetails.imageUrl}
                alt="Your sticker"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        <Card className="mb-6">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Order ID</p>
                <p className="font-medium text-gray-900">{orderDetails?.orderId}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Estimated Delivery</p>
                <p className="font-medium text-gray-900">{orderDetails?.estimatedDelivery}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-3">What's Next?</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 bg-[#00C2FF]/20 rounded-full flex items-center justify-center text-xs font-bold text-[#00C2FF]">1</span>
              We'll print your sticker sheet with premium quality
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 bg-[#00C2FF]/20 rounded-full flex items-center justify-center text-xs font-bold text-[#00C2FF]">2</span>
              You'll receive a shipping notification
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 bg-[#00C2FF]/20 rounded-full flex items-center justify-center text-xs font-bold text-[#00C2FF]">3</span>
              Your stickers arrive at your door!
            </li>
          </ul>
        </div>

        <button onClick={handleNewOrder} className="w-full pill-button pill-button-secondary">
          <Home className="w-5 h-5" />
          Create Another Sticker
        </button>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="loading-spinner" />
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  )
}
