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
import ImageRevealSlider from '@/components/ImageRevealSlider'
import TicTacToeGame from '@/components/TicTacToeGame'

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
  const [elapsedTime, setElapsedTime] = useState(0)
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
    
    // Prevent concurrent requests (double-click protection)
    if (isGenerating) {
      console.log('Request already in progress, ignoring...')
      return
    }
    
    setIsGenerating(true)
    setShowResult(false)
    setError(null)
    setElapsedTime(0)

    // Show loading animation with timer
    const messageInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev >= loadingMessages.length - 1) {
          return 0
        }
        return prev + 1
      })
    }, 1200)

    // Timer for elapsed time (updates every 0.1 seconds)
    const timerInterval = setInterval(() => {
      setElapsedTime(prev => prev + 0.1)
    }, 100)

    try {
      // Check if we should use testing mode
      const isTestingMode = process.env.NEXT_PUBLIC_TESTING_MODE === 'true'
      console.log('Testing mode enabled:', isTestingMode)
      
      if (isTestingMode) {
        // TESTING MODE: Skip actual API call and simulate success
        console.log('Testing mode: Simulating image generation for style:', selectedStyle)
        console.log('Using uploaded image:', uploadedImageUrl ? 'yes' : 'no')
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        decrementCredit()
        console.log('Credits after decrement:', credits - 1)
        
        clearInterval(messageInterval)
        clearInterval(timerInterval)
        
        // Use uploaded image or fallback to placeholder  
        const testImage = uploadedImageUrl || '/cartoon-presets/outputexample.png'
        console.log('Setting test image:', testImage)
        setGeneratedImage(testImage)
        setIsGenerating(false)
        setShowResult(true)
        console.log('Testing mode: Generation complete!')
        return
      }

      // PRODUCTION MODE: Real API call
      // Create fresh FormData and File to avoid stream consumption issues
      const formData = new FormData()
      
      // Create fresh File from the current uploaded image to avoid stream reuse
      const freshImageFile = new File([uploadedImage], uploadedImage.name, {
        type: uploadedImage.type,
        lastModified: uploadedImage.lastModified
      })
      
      formData.append('image', freshImageFile)
      formData.append('style', selectedStyle)
      
      console.log('Sending request to /api/stylize with:', {
        imageSize: uploadedImage.size,
        imageType: uploadedImage.type,
        style: selectedStyle
      })
      
      const res = await fetch('/api/stylize', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(90000), // 90 second timeout
      })
      
      console.log('Response status:', res.status, res.statusText)
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('API Error Response:', errorText)
        
        // Handle specific error types
        if (res.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        } else if (res.status === 401) {
          throw new Error('Authentication failed. Please check your API key.')
        } else if (res.status === 400) {
          // Try to parse the error response for better messaging
          try {
            const errorData = JSON.parse(errorText)
            if (errorData.error && errorData.error.includes('safety filters')) {
              throw new Error('This image was blocked by content safety filters. Please try a different photo.')
            }
          } catch (e) {
            // Fall back to generic 400 error
          }
          throw new Error(`Image processing failed: ${res.status} ${res.statusText}`)
        } else {
          throw new Error(`Server error: ${res.status} ${res.statusText}`)
        }
      }
      
      const data = await res.json()
      console.log('Success response received')
      
      decrementCredit()
      
      clearInterval(messageInterval)
      clearInterval(timerInterval)
      setGeneratedImage(`data:image/png;base64,${data.imageBase64}`)
      setIsGenerating(false)
      setShowResult(true)
      
    } catch (err: any) {
      clearInterval(messageInterval)
      clearInterval(timerInterval)
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
    <div className="min-h-screen bg-white overflow-x-hidden">
      <div className="max-w-md mx-auto bg-white min-h-screen relative">
        {/* Floating modern elements */}
        <div className="absolute top-20 left-4 w-3 h-3 bg-teal-400 rounded-full animate-bounce opacity-60 blur-[0.5px]"></div>
        <div className="absolute top-32 right-6 w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-300 opacity-60 blur-[0.5px]"></div>
        <div className="absolute top-48 left-8 w-1.5 h-1.5 bg-teal-300 rounded-full animate-bounce delay-500 opacity-60 blur-[0.5px]"></div>

        {/* Header */}
        <div className="relative bg-white p-6 rounded-b-3xl overflow-hidden">
          <div className="absolute top-4 right-6 w-8 h-8 bg-gradient-to-r from-[#00C2FF] to-[#FF7B36] rounded-full animate-bounce opacity-20"></div>
          <div className="absolute bottom-4 left-6 w-6 h-6 bg-gradient-to-r from-[#6C63FF] to-[#00C2FF] rounded-full animate-bounce delay-300 opacity-20"></div>

          <div className="relative z-10">
            <h1 className="title text-center mb-6">
              Cartoonify
              <br />
              <span className="bg-gradient-to-r from-[#00C2FF] to-[#FF7B36] bg-clip-text text-transparent">Yourself</span>
            </h1>

            {/* Before/After Example */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="relative transform hover:scale-105 transition-transform">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-gray-200">
                  <img
                    src="/cartoon-presets/inputexample.jpg"
                    alt="Before transformation"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white">📸</span>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <ArrowRight className="w-6 h-6 text-[#00C2FF] animate-bounce" />
                <span className="text-xs font-semibold mt-1 text-[#00C2FF]">Transform</span>
              </div>

              <div className="relative transform hover:scale-105 transition-transform">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-[#00C2FF]">
                  <img
                    src="/cartoon-presets/outputexample.png"
                    alt="After transformation"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-[#00C2FF] to-[#FF7B36] rounded-full flex items-center justify-center animate-bounce">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
            </div>

            <p className="subtitle text-center">
              Transform into your favorite cartoon character
            </p>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Step 1: Style Selection */}
          <div className="space-y-4 animate-fade-slide-in">
            <div className="flex items-center gap-3">
              <div className="step-marker animate-bounce">
                1
              </div>
              <h2 className="subtitle">Pick your cartoon style</h2>
            </div>

            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3 w-max">
                {cartoonStyles.map((style, index) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`flex flex-col items-center p-4 min-w-[100px] ${
                      selectedStyle === style.id
                        ? "sticker-card selected animate-pop"
                        : "sticker-card"
                    }`}
                    style={{
                      minHeight: "44px",
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden mb-3">
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
                    <span className="text-sm font-medium text-center leading-tight">
                      {style.name}
                    </span>
                    {selectedStyle === style.id && (
                      <Badge className="mt-2 bg-gradient-to-r from-[#FF7B36] to-[#6C63FF] text-white text-xs animate-bounce border-0">
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
            <div className="space-y-4 animate-fade-slide-in">
              <div className="flex items-center gap-3">
                <div className="step-marker animate-bounce">
                  2
                </div>
                <h2 className="subtitle">Upload your photo</h2>
              </div>

              {uploadedImageUrl ? (
                <Card className="card">
                  <CardContent className="card-content">
                    <div className="relative">
                      <img
                        src={uploadedImageUrl}
                        alt="Uploaded photo"
                        className="w-full max-h-80 object-contain rounded-xl bg-gray-50"
                      />
                      <Badge className="absolute top-3 right-3 bg-gradient-to-r from-green-400 to-emerald-400 text-white font-semibold text-sm animate-bounce border-0">
                        <Zap className="w-3 h-3 mr-1" />
                        Ready!
                      </Badge>
                      <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-gradient-to-r from-[#00C2FF] to-[#FF7B36] rounded-full flex items-center justify-center animate-bounce">
                        <Star className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="upload-area">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="w-16 h-16 bg-gradient-to-r from-[#00C2FF] to-[#0EA5E9] rounded-2xl flex items-center justify-center animate-bounce">
                        <Upload className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <p className="subtitle mb-2">Upload your photo</p>
                        <p className="body text-gray-500">Max 5MB • JPG, PNG supported</p>
                      </div>
                    </div>
                  </label>
                </div>
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
            <div className="space-y-4 animate-fade-slide-in">
              <div className="flex items-center gap-3">
                <div className="step-marker animate-bounce">
                  3
                </div>
                <h2 className="subtitle">Create your cartoon</h2>
              </div>

              {error && (
                <Card className="card border-red-500 border-2">
                  <CardContent className="card-content">
                    <p className="text-red-600 font-semibold text-center">{error}</p>
                  </CardContent>
                </Card>
              )}

              {!showResult ? (
                <>
                  {!isGenerating ? (
                    <button
                      onClick={handleGenerate}
                      disabled={!hasCredits}
                      className={`w-full pill-button ${
                        hasCredits 
                          ? 'pill-button-primary' 
                          : 'pill-button:disabled'
                      }`}
                    >
                      <Sparkles className="w-5 h-5 animate-spin" />
                      {hasCredits 
                        ? (isFreeUser ? `Try Free! (${credits} left)` : 'Cartoonify Me!') 
                        : 'Buy Credits to Start'
                      }
                      <Sparkles className="w-5 h-5 animate-spin" />
                    </button>
                  ) : (
                    <div className="space-y-4">
                      {/* Generation Status */}
                      <Card className="card">
                        <CardContent className="card-content text-center">
                          <div className="space-y-4">
                            <div className="w-16 h-16 bg-gradient-to-r from-[#00C2FF] to-[#0EA5E9] rounded-2xl mx-auto flex items-center justify-center animate-bounce">
                              <div className="loading-spinner"></div>
                            </div>
                            <div>
                              <p className="subtitle mb-2">{loadingMessages[loadingStep]}</p>
                              <div className="text-xl font-mono font-bold text-[#00C2FF] mb-3">
                                {elapsedTime.toFixed(1)}s
                              </div>
                              <div className="progress-bar">
                                <div
                                  className="progress-fill"
                                  style={{ width: `${Math.min((elapsedTime / 30) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* Tic-Tac-Toe Game */}
                      <div className="animate-fade-slide-in">
                        <TicTacToeGame
                          playerImage={uploadedImageUrl!}
                          opponentImage={cartoonStyles.find(style => style.id === selectedStyle)?.image || '/cartoon-presets/heyarnold.png'}
                          opponentName={selectedStyle}
                          autoEnd={!isGenerating || showResult}
                          onGameEnd={() => {
                            if (generatedImage) {
                              setShowResult(true)
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : generatedImage && (
                <div className="space-y-6">
                  {/* Success Header */}
                  <div className="text-center">
                    <Badge className="bg-gradient-to-r from-green-400 to-emerald-400 text-white font-semibold text-base px-6 py-3 animate-bounce rounded-xl border-0">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Cartoon complete!
                    </Badge>
                  </div>

                  {/* Interactive Image Reveal Slider */}
                  <div className="space-y-4">
                    <ImageRevealSlider
                      beforeSrc={uploadedImageUrl!}
                      afterSrc={generatedImage}
                      altBefore="Original"
                      altAfter={`${cartoonStyles.find((s) => s.id === selectedStyle)?.name} Style`}
                      height={380}
                      initial={75}
                      className="mx-auto"
                    />
                    
                    <div className="text-center">
                      <p className="body text-gray-500">Drag the slider or tap to compare • Use arrow keys for fine control</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-4 animate-fade-slide-in">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        className="pill-button pill-button-secondary"
                        onClick={async () => {
                          try {
                            // For external URLs, we need to fetch and convert to blob
                            const response = await fetch(generatedImage!)
                            const blob = await response.blob()
                            const url = window.URL.createObjectURL(blob)
                            
                            const link = document.createElement('a')
                            link.href = url
                            link.download = `cartoon-${selectedStyle?.replace(/\s+/g, '-').toLowerCase()}.png`
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                            window.URL.revokeObjectURL(url)
                          } catch (error) {
                            console.error('Failed to save image:', error)
                            // Fallback to simple link approach
                            window.open(generatedImage, '_blank')
                          }
                        }}
                      >
                        <Download className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={handleTryAgain}
                        className="pill-button pill-button-secondary"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Try Again
                      </button>
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