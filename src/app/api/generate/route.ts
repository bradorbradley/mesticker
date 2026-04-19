import { NextRequest, NextResponse } from "next/server"
import { generateSticker } from "@/lib/gemini"
import { uploadImage, hasTransparentBackground } from "@/lib/cloudinary"
import { STYLE_PRESETS, StylePresetKey } from "@/lib/constants"
import { trackGeneration } from "@/lib/supabase"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File | null
    const style = formData.get("style") as string | null

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }
    if (!style || !(style in STYLE_PRESETS)) {
      return NextResponse.json({ error: "Invalid style preset" }, { status: 400 })
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(arrayBuffer).toString("base64")

    const stylePreset = STYLE_PRESETS[style as StylePresetKey]

    console.log(`[generate] style=${style}`)
    const tGen = Date.now()

    const generatedImageBase64 = await generateSticker(base64Image, stylePreset.prompt)

    console.log(`[generate] gemini done in ${Date.now() - tGen}ms`)

    // Check if Gemini actually gave us a transparent PNG.
    // If not, we'll trigger Cloudinary's AI background removal as a safety net.
    const hasAlpha = await hasTransparentBackground(generatedImageBase64)
    console.log(`[generate] has_alpha_channel=${hasAlpha}`)

    const tUpload = Date.now()
    const imageUrl = await uploadImage(
      generatedImageBase64,
      "mesticker/stickers",
      !hasAlpha // run bg removal if Gemini didn't provide transparency
    )
    console.log(`[generate] cloudinary done in ${Date.now() - tUpload}ms -> ${imageUrl}`)

    try {
      await trackGeneration(style, imageUrl)
    } catch (e) {
      console.log("[generate] supabase tracking skipped:", e)
    }

    const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(7)}`

    return NextResponse.json({
      imageUrl,
      generationId,
      style: stylePreset.name,
      hadAlpha: hasAlpha,
    })
  } catch (error: any) {
    console.error("[generate] error:", error)

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
