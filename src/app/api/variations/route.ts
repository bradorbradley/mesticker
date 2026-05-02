import { NextRequest, NextResponse } from "next/server";
import { generatePreview } from "@/lib/generation";
import { buildVariationPrompt, VARIATION_DESCRIPTORS } from "@/lib/presets";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { recordGeneration, isThrottled } from "@/lib/spend-tracker";

export const maxDuration = 120; // 6 parallel gens can take a moment

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    // Rate limit (shares the same pool as generate)
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

    const { image, stylePrompt } = await request.json();

    if (!image || !stylePrompt) {
      return NextResponse.json(
        { error: "Missing image or stylePrompt" },
        { status: 400 }
      );
    }

    // Generate 6 variations in parallel
    const results = await Promise.allSettled(
      VARIATION_DESCRIPTORS.map(async (variation, index) => {
        const prompt = buildVariationPrompt(stylePrompt, variation);
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
