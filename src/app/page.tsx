"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Upload, Download, Share2, RotateCcw, Sparkles, Zap, Star, Heart } from "lucide-react"
import Image from "next/image"
import { sdk } from '@farcaster/miniapp-sdk'
import CreditSystem from '@/components/CreditSystem'
import { useCredits } from '@/hooks/useCredits'

const cartoonStyles = [
  {
    id: "Hey Arnold",
    name: "Hey Arnold",
    image: "/cartoon-presets/heyarnold.png",
  },
  {
    id: "Fairly Odd Parents",
    name: "Fairly Odd Parents",
    image: "/cartoon-presets/fairlyoddparents.png",
  },
  {
    id: "Scooby Doo",
    name: "Scooby Doo",
    image: "/cartoon-presets/scoobydoo.png",
  },
  {
    id: "SpongeBob",
    name: "SpongeBob",
    image: "/cartoon-presets/spongebob.png",
  },
  {
    id: "The Simpsons",
    name: "The Simpsons",
    image: "/cartoon-presets/simpsons.png",
  },
  {
    id: "Family Guy",
    name: "Family Guy",
    image: "/cartoon-presets/familyguy.png",
  },
  {
    id: "Rick and Morty",
    name: "Rick and Morty",
    image: "/cartoon-presets/rickandmorty.png",
  },
]

const loadingMessages = [
  "🎨 Getting creative...",
  "🌟 Adding cartoon magic...",
  "🎭 Drawing your features...",
  "✨ Sprinkling cartoon dust...",
  "🎪 Almost ready to show!",
]

export default function CartoonifyApp() {
  const [selectedStyle, setSelectedStyle] = useState("Hey Arnold")
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userFid, setUserFid] = useState<number | null>(null)
  const [posting, setPosting] = useState(false)
  
  const { hasCredits, useCredit: decrementCredit, credits, isFreeUser } = useCredits()

  useEffect(() => {
    sdk.actions.ready()
  }, [])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      const url = URL.createObjectURL(file)
      setUploadedImageUrl(url)
    }
  }

  const handleGenerate = async () => {
    if (!uploadedImage || !selectedStyle) return
    
    if (!hasCredits) {
      setError('You need credits to generate cartoons. Please purchase credits to continue.')
      return
    }
    
    setIsGenerating(true)
    setShowResult(false)
    setError(null)

    // Show loading animation
    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev >= loadingMessages.length - 1) {
          clearInterval(interval)
          return 0
        }
        return prev + 1
      })
    }, 1200)

    try {
      // Check if we should use testing mode (temporary: always true for payment testing)
      const isTestingMode = true // process.env.NEXT_PUBLIC_TESTING_MODE === 'true'
      
      if (isTestingMode) {
        // TESTING MODE: Skip actual API call and simulate success
        console.log('Testing mode: Simulating image generation')
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        decrementCredit()
        
        clearInterval(interval)
        // Use a placeholder image for testing
        setGeneratedImage(uploadedImageUrl || '/cartoon-presets/outputexample.png')
        setIsGenerating(false)
        setShowResult(true)
        return
      }

      // PRODUCTION MODE: Real API call
      const formData = new FormData()
      formData.append('image', uploadedImage)
      formData.append('style', selectedStyle)
      
      console.log('Sending request to /api/stylize with:', {
        imageSize: uploadedImage.size,
        imageType: uploadedImage.type,
        style: selectedStyle
      })
      
      const res = await fetch('/api/stylize', {
        method: 'POST',
        body: formData,
      })
      
      console.log('Response status:', res.status, res.statusText)
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('API Error Response:', errorText)
        throw new Error(`Server error: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      console.log('Success response received')
      
      decrementCredit()
      
      clearInterval(interval)
      setGeneratedImage(data.imageUrl)
      setIsGenerating(false)
      setShowResult(true)
      
    } catch (err: any) {
      clearInterval(interval)
      console.error('Client error:', err)
      
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Network connection failed. Please check your internet connection and try again.')
      } else if (err.message.includes('timeout')) {
        setError('Request timed out. Image generation is taking longer than expected. Please try again.')
      } else {
        setError(err.message || 'Unknown error occurred')
      }
      setIsGenerating(false)
    }
  }

  const handleFarcasterAuth = async () => {
    try {
      const token = await sdk.quickAuth.getToken()
      if (token) {
        setIsAuthenticated(true)
        setUserFid(12345)
      }
    } catch (error) {
      console.error('Farcaster auth failed:', error)
      setError('Failed to authenticate with Farcaster')
    }
  }

  const handleShareToFarcaster = async () => {
    if (!generatedImage) return
    
    setPosting(true)
    try {
      const shareData = {
        imageUrl: generatedImage,
        text: `Check out my ${selectedStyle} style avatar created with MeSticker! 🎨 #MeSticker #${selectedStyle?.replace(/\\s+/g, '') || 'Cartoon'}`
      }

      await sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareData.text)}&embeds[]=${encodeURIComponent(shareData.imageUrl)}`)
      
    } catch (error) {
      console.error('Failed to share to Farcaster:', error)
      setError('Failed to share to Farcaster')
    } finally {
      setPosting(false)
    }
  }

  const handleTryAgain = () => {
    setShowResult(false)
    setGeneratedImage(null)
    setUploadedImage(null)
    setUploadedImageUrl(null)
    setSelectedStyle("Hey Arnold")
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 font-medium overflow-x-hidden">
      <div className="max-w-md mx-auto bg-gradient-to-b from-slate-900 to-black min-h-screen relative">
        {/* Floating modern elements */}
        <div className="absolute top-20 left-4 w-3 h-3 bg-teal-400 rounded-full animate-bounce opacity-60 blur-[0.5px]"></div>
        <div className="absolute top-32 right-6 w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-300 opacity-60 blur-[0.5px]"></div>
        <div className="absolute top-48 left-8 w-1.5 h-1.5 bg-teal-300 rounded-full animate-bounce delay-500 opacity-60 blur-[0.5px]"></div>

        {/* Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-gray-800 to-slate-900 text-white p-6 rounded-b-3xl modern-shadow-lg overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-cyan-500/5 to-teal-500/5"></div>
          <div className="absolute top-4 left-6 w-8 h-8 bg-teal-400/10 rounded-full animate-pulse blur-sm"></div>
          <div className="absolute bottom-4 right-6 w-6 h-6 bg-cyan-400/10 rounded-full animate-pulse delay-700 blur-sm"></div>

          <div className="relative z-10">
            <h1 className="modern-title text-center mb-6 tracking-tight">
              Cartoonify
              <br />
              <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">Yourself</span>
            </h1>

            {/* Before/After Example */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="relative transform hover:scale-105 transition-transform">
                <div className="w-16 h-16 rounded-2xl overflow-hidden modern-shadow border-2 border-white/20 cartoon-bounce">
                  <img
                    src="/cartoon-presets/inputexample.jpg"
                    alt="Before transformation"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white">📸</span>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <ArrowRight className="w-6 h-6 text-teal-400 animate-pulse cartoon-wiggle" />
                <span className="text-xs font-semibold mt-1 text-teal-400">Transform</span>
              </div>

              <div className="relative transform hover:scale-105 transition-transform">
                <div className="w-16 h-16 rounded-2xl overflow-hidden modern-shadow border-2 border-teal-400/50 cartoon-bounce modern-glow">
                  <img
                    src="/cartoon-presets/outputexample.png"
                    alt="After transformation"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full flex items-center justify-center animate-bounce">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
            </div>

            <p className="text-center text-sm font-medium text-gray-300">
              Transform into your favorite cartoon character
            </p>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Step 1: Style Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-teal-400 to-cyan-400 text-white rounded-xl flex items-center justify-center text-sm font-bold modern-shadow cartoon-bounce">
                1
              </div>
              <h2 className="modern-heading">Pick your cartoon style</h2>
            </div>

            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3 w-max">
                {cartoonStyles.map((style, index) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 min-w-[100px] transform hover:scale-105 cartoon-card ${
                      selectedStyle === style.id
                        ? "modern-card modern-shadow-lg scale-110 cartoon-selected ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-900"
                        : "modern-card-dark modern-shadow hover:bg-slate-700/50"
                    }`}
                    style={{
                      minHeight: "44px",
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    <div
                      className={`w-14 h-14 rounded-xl overflow-hidden mb-3 transition-all cartoon-bounce ${
                        selectedStyle === style.id
                          ? "ring-2 ring-teal-400 modern-glow animate-pulse"
                          : "ring-1 ring-white/20"
                      }`}
                    >
                      <img
                        src={style.image}
                        alt={style.name}
                        className="w-full h-full object-cover rounded-xl"
                        onError={(e) => {
                          // Fallback to emoji if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = `<div class="w-full h-full bg-gray-200 rounded-xl flex items-center justify-center text-2xl">${
                            style.name === 'Hey Arnold' ? '🏈' :
                            style.name === 'Fairly Odd Parents' ? '🧚' :
                            style.name === 'Scooby Doo' ? '🐕' :
                            style.name === 'SpongeBob' ? '🧽' :
                            style.name === 'The Simpsons' ? '🍩' :
                            style.name === 'Family Guy' ? '👨' :
                            style.name === 'Rick and Morty' ? '🛸' : '🎭'
                          }</div>`;
                        }}
                      />
                    </div>
                    <span
                      className={`modern-card-text text-center leading-tight ${
                        selectedStyle === style.id ? "text-gray-900 font-semibold" : "text-gray-300"
                      }`}
                    >
                      {style.name}
                    </span>
                    {selectedStyle === style.id && (
                      <Badge className="mt-2 bg-gradient-to-r from-teal-400 to-cyan-400 text-white text-xs animate-bounce border-0 modern-shadow">
                        <Heart className="w-3 h-3 mr-1" />
                        Selected
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2: Upload */}
          {selectedStyle && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-teal-400 to-cyan-400 text-white rounded-xl flex items-center justify-center text-sm font-bold modern-shadow cartoon-bounce">
                  2
                </div>
                <h2 className="modern-heading">Upload your photo</h2>
              </div>

              {uploadedImageUrl ? (
                <Card className="modern-card modern-shadow-lg cartoon-card border-0">
                  <CardContent className="p-5">
                    <div className="relative">
                      <img
                        src={uploadedImageUrl}
                        alt="Uploaded photo"
                        className="w-full h-44 object-cover rounded-xl"
                      />
                      <Badge className="absolute top-3 right-3 bg-gradient-to-r from-green-400 to-emerald-400 text-white font-semibold text-sm animate-bounce border-0 modern-shadow">
                        <Zap className="w-3 h-3 mr-1" />
                        Ready!
                      </Badge>
                      <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full flex items-center justify-center animate-spin-slow modern-shadow">
                        <Star className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="modern-card-dark modern-shadow hover:bg-slate-700/30 transition-all duration-300 cartoon-card hover:scale-105 border-0 border-dashed border-teal-400/30">
                  <CardContent className="p-8">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-2xl flex items-center justify-center modern-shadow cartoon-bounce">
                          <Upload className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-white mb-2 text-base">Upload your photo</p>
                          <p className="text-sm text-gray-400 font-medium">Max 5MB • JPG, PNG supported</p>
                        </div>
                      </div>
                    </label>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Credit System - Always show after image upload */}
          {selectedStyle && uploadedImage && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <CreditSystem />
            </div>
          )}


          {/* Step 3: Generate */}
          {selectedStyle && uploadedImage && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-teal-400 to-cyan-400 text-white rounded-xl flex items-center justify-center text-sm font-bold modern-shadow cartoon-bounce">
                  3
                </div>
                <h2 className="modern-heading">Create your cartoon</h2>
              </div>

              {error && (
                <Card className="modern-card border-red-500 border-2">
                  <CardContent className="p-4">
                    <p className="text-red-600 font-semibold text-center">{error}</p>
                  </CardContent>
                </Card>
              )}

              {!showResult ? (
                <>
                  {!isGenerating ? (
                    <Button
                      onClick={handleGenerate}
                      disabled={!hasCredits}
                      className={`w-full h-14 text-base font-semibold transition-all duration-300 transform hover:scale-105 rounded-2xl ${
                        hasCredits 
                          ? 'btn-primary modern-button cartoon-button' 
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <Sparkles className="w-5 h-5 mr-3 animate-spin" />
                      {hasCredits ? 'Cartoonify Me!' : 'Buy Credits to Start'}
                      <Sparkles className="w-5 h-5 ml-3 animate-spin" />
                    </Button>
                  ) : (
                    <Card className="modern-card modern-shadow-lg cartoon-card border-0">
                      <CardContent className="p-8 text-center">
                        <div className="space-y-6">
                          <div className="w-16 h-16 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-2xl mx-auto flex items-center justify-center animate-pulse modern-shadow">
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 mb-3 text-base">{loadingMessages[loadingStep]}</p>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-teal-400 to-cyan-400 h-full rounded-full transition-all duration-1000"
                                style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : generatedImage && (
                <div className="space-y-6">
                  {/* Success Header */}
                  <div className="text-center">
                    <Badge className="bg-gradient-to-r from-green-400 to-emerald-400 text-white font-semibold text-base px-6 py-3 animate-bounce rounded-xl border-0 modern-shadow">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Cartoon complete!
                    </Badge>
                  </div>

                  {/* Result Image */}
                  <Card className="modern-card modern-shadow-lg cartoon-card border-0">
                    <CardContent className="p-5">
                      <div className="relative">
                        <img
                          src={generatedImage}
                          alt="Generated cartoon"
                          className="w-full h-60 object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-xl"></div>
                        <Badge className="absolute bottom-4 left-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold border-0 rounded-lg modern-shadow">
                          {cartoonStyles.find((s) => s.id === selectedStyle)?.name} Style
                        </Badge>
                        <div className="absolute top-4 right-4 w-7 h-7 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full flex items-center justify-center animate-bounce modern-shadow">
                          <Star className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Farcaster Actions */}
                  <div className="space-y-4">
                    {!isAuthenticated ? (
                      <Button 
                        onClick={handleFarcasterAuth}
                        className="w-full h-12 btn-primary modern-button text-base font-semibold transition-all duration-300 transform hover:scale-105 rounded-2xl cartoon-button"
                      >
                        <Share2 className="w-4 h-4 mr-3" />
                        Sign in with Farcaster
                        <Sparkles className="w-4 h-4 ml-3" />
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleShareToFarcaster}
                        disabled={posting}
                        className="w-full h-12 btn-primary modern-button text-base font-semibold transition-all duration-300 transform hover:scale-105 rounded-2xl cartoon-button"
                      >
                        <Share2 className="w-4 h-4 mr-3" />
                        {posting ? 'Sharing...' : 'Post to Farcaster'}
                        <Sparkles className="w-4 h-4 ml-3" />
                      </Button>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        className="h-11 btn-secondary modern-button font-semibold transition-all duration-300 rounded-xl cartoon-button bg-transparent"
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = generatedImage
                          link.download = `cartoon-${selectedStyle}.png`
                          link.click()
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleTryAgain}
                        className="h-11 btn-secondary modern-button font-semibold transition-all duration-300 rounded-xl cartoon-button bg-transparent"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Try Again
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}