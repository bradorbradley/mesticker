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

    // Step 1: Remove background (optional — skip if API key not configured)
    let processedImage = image;
    let bgRemoved = false;
    if (process.env.REMOVEBG_API_KEY) {
      try {
        processedImage = await removeBackground(image);
        bgRemoved = true;
      } catch (e) {
        console.warn("Background removal failed, continuing without it:", e);
      }
    }

    // Step 2: Apply style with Gemini
    // If background wasn't removed, tell Gemini to handle it
    const prompt = bgRemoved
      ? preset.prompt
      : `${preset.prompt} First remove the background from the photo, then apply the style.`;
    const styledImage = await generateStickerImage(processedImage, prompt);

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
