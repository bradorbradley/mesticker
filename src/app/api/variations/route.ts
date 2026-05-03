import { NextRequest, NextResponse } from "next/server";
import { generatePreview } from "@/lib/generation";
import { buildVariationPrompt } from "@/lib/presets";
import { extractSubjectContext, tunedDescriptors } from "@/lib/vision";
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
    // Optionally also receive the original photo for vision-aware tuning.
    const { image, originalPhoto } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Missing cartoon image" },
        { status: 400 }
      );
    }

    // Vision pass on the original photo to tune variation descriptors.
    // If no originalPhoto provided or vision fails, we fall back to defaults.
    const ctx = originalPhoto ? await extractSubjectContext(originalPhoto) : null;
    const descriptors = tunedDescriptors(ctx);

    // Generate 9 variations in parallel using the cartoon as source
    const results = await Promise.allSettled(
      descriptors.map(async (variation, index) => {
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
      if (r.status === "fulfilled") return r.value;
      return {
        index: i,
        image: null,
        latency: 0,
        variation: descriptors[i],
        error: r.reason?.message || "Generation failed",
      };
    });

    return NextResponse.json({ variations, context: ctx });
  } catch (error) {
    console.error("Variations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Variations failed" },
      { status: 500 }
    );
  }
}
