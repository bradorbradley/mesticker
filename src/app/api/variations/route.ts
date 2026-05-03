import { NextRequest, NextResponse } from "next/server";
import { generatePreview } from "@/lib/generation";
import { buildVariationPrompt, VARIATION_DESCRIPTORS } from "@/lib/presets";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { recordGeneration, isThrottled } from "@/lib/spend-tracker";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    const rateCheck = checkRateLimit(`gen:${clientIP}`, 10, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many generations. Please try again later." },
        { status: 429 }
      );
    }

    if (isThrottled()) {
      return NextResponse.json(
        { error: "High demand — please try again shortly." },
        { status: 503 }
      );
    }

    // The image we receive is the FIRST cartoon (not the original photo).
    // Feeding the cartoon back in keeps the character identity locked across
    // all 6 variations — same face, same outfit, same style, just new pose.
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Missing cartoon image" },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      VARIATION_DESCRIPTORS.map(async (variation, index) => {
        const prompt = buildVariationPrompt(variation);
        const startTime = Date.now();
        const result = await generatePreview(image, prompt);
        recordGeneration("preview");
        return {
          index,
          image: result,
          latency: Date.now() - startTime,
          variation,
        };
      })
    );

    const variations = results.map((r, i) => {
      if (r.status === "fulfilled") {
        return r.value;
      }
      return {
        index: i,
        image: null,
        latency: 0,
        variation: VARIATION_DESCRIPTORS[i],
        error: r.reason?.message || "Generation failed",
      };
    });

    return NextResponse.json({ variations });
  } catch (error) {
    console.error("Variations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Variations failed" },
      { status: 500 }
    );
  }
}
