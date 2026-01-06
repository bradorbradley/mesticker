import { NextRequest, NextResponse } from "next/server"
import { generateSticker } from "@/lib/gemini"
import { uploadImage } from "@/lib/cloudinary"
import { STYLE_PRESETS, StylePresetKey } from "@/lib/constants"
import { trackGeneration } from "@/lib/supabase"

export const maxDuration = 60 // 60 seconds max for Vercel

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File | null
    const style = formData.get("style") as string | null

    if (!imageFile) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      )
    }

    if (!style || !(style in STYLE_PRESETS)) {
      return NextResponse.json(
        { error: "Invalid style preset" },
        { status: 400 }
      )
    }

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(arrayBuffer).toString("base64")

    // Get style prompt
    const stylePreset = STYLE_PRESETS[style as StylePresetKey]
    const prompt = stylePreset.prompt

    console.log(`Generating sticker with style: ${style}`)

    // Generate styled image using Gemini
    const generatedImageBase64 = await generateSticker(base64Image, prompt)

    // Upload to Cloudinary
    const imageUrl = await uploadImage(generatedImageBase64, "mesticker/stickers")

    console.log(`Sticker generated and uploaded: ${imageUrl}`)

    // Track generation (optional - won't fail if Supabase not configured)
    try {
      await trackGeneration(style, imageUrl)
    } catch (e) {
      console.log("Supabase tracking skipped:", e)
    }

    // Generate a unique generation ID
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(7)}`

    return NextResponse.json({
      imageUrl,
      generationId,
      style: stylePreset.name,
    })
  } catch (error: any) {
    console.error("Generation error:", error)

    // Handle specific errors
    if (error.message?.includes("SAFETY")) {
      return NextResponse.json(
        { error: "Image was blocked by content safety filters. Please try a different photo." },
        { status: 400 }
      )
    }

    if (error.message?.includes("rate limit") || error.message?.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a moment and try again." },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Failed to generate sticker" },
      { status: 500 }
    )
  }
}
