import { NextRequest, NextResponse } from "next/server";
import { resolvePresetPrompt, stylePresets } from "@/lib/presets";
import { generateSticker } from "@/lib/image-providers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { recordGeneration, recordError, isThrottled } from "@/lib/spend-tracker";

// A booth is one IP serving a whole line of guests, so the limit is much
// higher than the web app's per-visitor limit.
const RATE_LIMIT_PER_IP = 240;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const GROUP_HINT =
  " If there are several people in the photo, include every one of them together in a single sticker.";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`booth:${getClientIP(request)}`, RATE_LIMIT_PER_IP, RATE_LIMIT_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Booth is cooling down — try again in a minute." }, { status: 429 });
  }
  if (isThrottled()) {
    return NextResponse.json({ error: "We're very busy right now — try again in a minute." }, { status: 503 });
  }

  try {
    const { image, styleId } = await request.json();
    if (!image || !styleId) {
      return NextResponse.json({ error: "Missing image or style" }, { status: 400 });
    }
    if (styleId !== "random" && !stylePresets.some((p) => p.id === styleId && p.id !== "custom")) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 });
    }

    const { prompt, resolvedId } = resolvePresetPrompt(styleId);
    const result = await generateSticker(image, prompt + GROUP_HINT);
    recordGeneration("preview");

    return NextResponse.json({
      generatedImage: result.image,
      stylePreset: resolvedId,
      provider: result.provider,
      model: result.model,
      ms: result.ms,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    console.error("[booth/generate]", msg);
    recordError(msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
