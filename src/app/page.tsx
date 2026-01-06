"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Sparkles, Camera, Star, Truck } from "lucide-react"
import PhotoUploader from "@/components/PhotoUploader"
import { STYLE_PRESETS } from "@/lib/constants"

export default function LandingPage() {
  const router = useRouter()
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const handleImageSelect = (file: File, previewUrl: string) => {
    setUploadedImage(file)
    setImagePreview(previewUrl)
  }

  const handleContinue = () => {
    if (imagePreview) {
      // Store image in session storage for the next page
      sessionStorage.setItem("uploadedImage", imagePreview)
      if (uploadedImage) {
        // Convert file to base64 and store
        const reader = new FileReader()
        reader.onloadend = () => {
          sessionStorage.setItem("uploadedImageBase64", reader.result as string)
          router.push("/create")
        }
        reader.readAsDataURL(uploadedImage)
      }
    }
  }

  const styleExamples = Object.values(STYLE_PRESETS).slice(0, 3)

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-[#00C2FF]/10 to-[#FF7B36]/10 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-[#FF7B36]" />
            <span className="text-sm font-medium text-gray-700">AI-Powered Stickers</span>
          </div>

          <h1 className="title mb-4">
            Turn Your Photos Into
            <br />
            <span className="bg-gradient-to-r from-[#00C2FF] to-[#FF7B36] bg-clip-text text-transparent">
              Custom Stickers
            </span>
          </h1>

          <p className="subtitle mb-6">
            Upload a photo, choose a style, and get beautiful AI-generated stickers shipped to your door
          </p>
        </div>

        {/* Example Transformations */}
        <div className="flex justify-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-gray-200">
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <Camera className="w-5 h-5 text-gray-500" />
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#00C2FF]" />
            <div className="flex -space-x-2">
              {styleExamples.map((style, i) => (
                <div
                  key={style.id}
                  className="w-12 h-12 rounded-lg border-2 border-white shadow-md bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center"
                  style={{ zIndex: 3 - i }}
                >
                  <span className="text-lg">
                    {style.id === "watercolor" ? "🎨" : style.id === "ghibli" ? "🌸" : "✨"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="space-y-6">
          <PhotoUploader
            onImageSelect={handleImageSelect}
            selectedImage={imagePreview}
            onClear={() => {
              setUploadedImage(null)
              setImagePreview(null)
            }}
          />

          {imagePreview && (
            <button
              onClick={handleContinue}
              className="w-full pill-button pill-button-primary animate-fade-slide-in"
            >
              <span>Choose Your Style</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto bg-gradient-to-br from-[#00C2FF]/20 to-[#00C2FF]/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#00C2FF]" />
            </div>
            <p className="text-xs font-medium text-gray-600">6 Unique Styles</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto bg-gradient-to-br from-[#FF7B36]/20 to-[#FF7B36]/10 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-[#FF7B36]" />
            </div>
            <p className="text-xs font-medium text-gray-600">Premium Quality</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto bg-gradient-to-br from-[#6C63FF]/20 to-[#6C63FF]/10 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-[#6C63FF]" />
            </div>
            <p className="text-xs font-medium text-gray-600">Fast Shipping</p>
          </div>
        </div>

        {/* Pricing Hint */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Starting at <span className="font-semibold text-gray-700">$9.99</span> per sticker
          </p>
        </div>
      </div>
    </div>
  )
}
