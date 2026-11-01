import { NextRequest, NextResponse } from "next/server";
import { generateAtQuality } from "@/lib/generation";
import { buildVariationPrompt } from "@/lib/presets";
import { generateVariationDescriptors } from "@/lib/vision";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { recordGeneration, isThrottled } from "@/lib/spend-tracker";

/**
 * Pose Pack, reusing the web app's variations engine.
 *   POST { photo }                 → { ideas: string[4] }  (vision pass designs poses for this person)
 *   POST { sticker, idea }         → { image }             (one new pose of the same character)
 * Split into one request per pose so each response stays small and the
 * booth can show poses as they arrive.
 */

export const maxDuration = 90;

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`booth-pose:${getClientIP(request)}`, 400, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Booth is cooling down" }, { status: 429 });
  if (isThrottled()) return NextResponse.json({ error: "Busy, try again in a minute" }, { status: 503 });

  try {
    const { photo, sticker, idea } = await request.json();
    if (photo && !sticker) {
      const { descriptors } = await generateVariationDescriptors(photo);
      return NextResponse.json({ ideas: descriptors.slice(0, 4) });
    }
    if (!sticker || typeof idea !== "string" || !idea.trim()) {
      return NextResponse.json({ error: "Missing sticker or pose" }, { status: 400 });
    }
    // same quality as the web app's variation tiles
    const image = await generateAtQuality(sticker, buildVariationPrompt(idea.slice(0, 300)), "low");
    recordGeneration("preview");
    return NextResponse.json({ image });
  } catch (error) {
    console.error("[booth/pose]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pose failed" }, { status: 500 });
  }
}
