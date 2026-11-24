import { NextRequest, NextResponse } from "next/server";
import { boothPresets, resolvePresetPrompt, withEventTheme } from "@/lib/presets";
import { generateVariationDescriptors } from "@/lib/vision";
import { generateSticker, requestedGeminiModel, requestedProvider } from "@/lib/image-providers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { recordGeneration, isThrottled } from "@/lib/spend-tracker";

/**
 * Pose / Mix packs. Both start from the ORIGINAL photo, so they can run in
 * parallel with the main sticker instead of waiting for it.
 *   POST { photo }                  → { ideas: string[9] } poses designed for this person
 *                                     (the web app's variations engine)
 *   POST { photo, styleId, idea }   → { image } one sticker: that style, that pose
 * One request per sticker keeps each response small and lets the booth show
 * them as they arrive.
 */

export const maxDuration = 90;

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`booth-pose:${getClientIP(request)}`, 600, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Booth is cooling down" }, { status: 429 });
  if (isThrottled()) return NextResponse.json({ error: "Busy, try again in a minute" }, { status: 503 });

  try {
    const { photo, styleId, idea, provider: wanted, theme } = await request.json();
    if (!photo) return NextResponse.json({ error: "Missing photo" }, { status: 400 });

    if (!idea) {
      const { descriptors } = await generateVariationDescriptors(photo);
      return NextResponse.json({ ideas: descriptors.slice(0, 9) });
    }
    if (!boothPresets.some((p) => p.id === styleId && p.id !== "custom" && p.id !== "random")) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 });
    }
    const prompt = withEventTheme(resolvePresetPrompt(styleId).prompt, theme);
    const pose = String(idea).slice(0, 300);
    const result = await generateSticker(
      photo,
      `${prompt} Pose and expression for this sticker: ${pose}. Same person, same hairstyle and outfit, fully recognizable. No text, captions or letters anywhere.`,
      "extra", // small sheet stickers: faster tier (see extrasProvider)
      requestedProvider(wanted),
      requestedGeminiModel(wanted)
    );
    recordGeneration("preview");
    return NextResponse.json({ image: result.image, ms: result.ms, provider: result.provider, model: result.model });
  } catch (error) {
    console.error("[booth/pose]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pose failed" }, { status: 500 });
  }
}
