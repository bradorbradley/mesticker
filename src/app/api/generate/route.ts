import { NextRequest, NextResponse } from "next/server";
import { removeBackground } from "@/lib/removebg";
import { generateStickerImage } from "@/lib/gemini";
import { stylePresets } from "@/lib/presets";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { image, styleId } = await request.json();

    if (!image || !styleId) {
      return NextResponse.json(
        { error: "Missing image or styleId" },
        { status: 400 }
      );
    }

    const preset = stylePresets.find((p) => p.id === styleId);
    if (!preset) {
      return NextResponse.json(
        { error: "Invalid style preset" },
        { status: 400 }
      );
    }

    // Step 1: Remove background
    const noBgImage = await removeBackground(image);

    // Step 2: Apply style with Gemini
    const styledImage = await generateStickerImage(noBgImage, preset.prompt);

    return NextResponse.json({
      originalImage: image,
      generatedImage: styledImage,
      stylePreset: styleId,
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
