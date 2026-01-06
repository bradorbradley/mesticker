"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Sparkles, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import StyleGrid from "@/components/StyleGrid"
import TicTacToeGame from "@/components/TicTacToeGame"
import { STYLE_PRESETS, StylePresetKey } from "@/lib/constants"

const loadingMessages = [
  "🎨 Getting creative...",
  "🌟 Adding artistic magic...",
  "🎭 Preserving your likeness...",
  "✨ Applying style effects...",
  "🎪 Almost ready to show!",
]

export default function CreatePage() {
  const router = useRouter()
  const [selectedStyle, setSelectedStyle] = useState<StylePresetKey | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [regenerateCount, setRegenerateCount] = useState(0)

  // Load uploaded image from session storage
  useEffect(() => {
    const storedImage = sessionStorage.getItem("uploadedImage")
    const storedBase64 = sessionStorage.getItem("uploadedImageBase64")

    if (!storedImage) {
      router.push("/")
      return
    }

    setUploadedImage(storedImage)
    setUploadedImageBase64(storedBase64)
  }, [router])

  const handleGenerate = async () => {
    if (!selectedStyle || !uploadedImageBase64) return

    setIsGenerating(true)
    setError(null)
    setElapsedTime(0)

    // Loading animation
    const messageInterval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % loadingMessages.length)
    }, 1200)

    const timerInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 0.1)
    }, 100)

    try {
      // Extract base64 data from data URL
      const base64Data = uploadedImageBase64.split(",")[1]

      // Create form data
      const formData = new FormData()

      // Convert base64 to blob
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: "image/jpeg" })

      formData.append("image", blob, "photo.jpg")
      formData.append("style", selectedStyle)

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate sticker")
      }

      const data = await response.json()

      // Store result and navigate to preview
      sessionStorage.setItem("generatedImage", data.imageUrl)
      sessionStorage.setItem("selectedStyle", selectedStyle)
      sessionStorage.setItem("generationId", data.generationId)

      clearInterval(messageInterval)
      clearInterval(timerInterval)

      router.push("/preview")
    } catch (err: any) {
      clearInterval(messageInterval)
      clearInterval(timerInterval)
      setError(err.message || "Failed to generate sticker")
      setIsGenerating(false)
    }
  }

  const handleBack = () => {
    router.push("/")
  }

  if (!uploadedImage) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    )
  }

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
          <div>
            <h1 className="text-xl font-bold text-gray-900">Choose Your Style</h1>
            <p className="text-sm text-gray-500">Select how you want your sticker to look</p>
          </div>
        </div>

        {/* Uploaded Image Preview */}
        <div className="mb-6">
          <div className="relative w-24 h-24 mx-auto rounded-xl overflow-hidden border-2 border-[#00C2FF] shadow-lg">
            <img
              src={uploadedImage}
              alt="Your photo"
              className="w-full h-full object-cover"
            />
            <Badge className="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs border-0">
              ✓
            </Badge>
          </div>
        </div>

        {/* Style Selection or Generation */}
        {!isGenerating ? (
          <div className="space-y-6">
            {/* Style Grid */}
            <StyleGrid
              selectedStyle={selectedStyle}
              onStyleSelect={setSelectedStyle}
            />

            {/* Error Message */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <p className="text-red-600 text-sm text-center">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Generate Button */}
            {selectedStyle && (
              <button
                onClick={handleGenerate}
                className="w-full pill-button pill-button-primary animate-fade-slide-in"
              >
                <Sparkles className="w-5 h-5" />
                Generate My Sticker
                <Sparkles className="w-5 h-5" />
              </button>
            )}

            {/* Regenerate info */}
            {regenerateCount === 0 && selectedStyle && (
              <p className="text-center text-sm text-gray-500">
                <RotateCcw className="w-4 h-4 inline mr-1" />
                1 free regeneration included
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Generation Status */}
            <Card className="card">
              <CardContent className="card-content text-center">
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-[#00C2FF] to-[#0EA5E9] rounded-2xl mx-auto flex items-center justify-center">
                    <div className="loading-spinner" />
                  </div>
                  <div>
                    <p className="subtitle mb-2">{loadingMessages[loadingStep]}</p>
                    <div className="text-xl font-mono font-bold text-[#00C2FF] mb-3">
                      {elapsedTime.toFixed(1)}s
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min((elapsedTime / 15) * 100, 95)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tic-Tac-Toe Game */}
            <div className="animate-fade-slide-in">
              <TicTacToeGame
                playerImage={uploadedImage}
                opponentImage={`/presets/${selectedStyle}.jpg`}
                opponentName={STYLE_PRESETS[selectedStyle]?.name || "AI"}
                autoEnd={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
