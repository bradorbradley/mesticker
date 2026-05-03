import { NextRequest, NextResponse } from "next/server";
import { generatePreview } from "@/lib/generation";
import { stylePresets, resolvePresetPrompt } from "@/lib/presets";
import { moderatePrompt } from "@/lib/moderation";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { recordGeneration, recordError, isThrottled } from "@/lib/spend-tracker";
import { sendAlert } from "@/lib/alerts";
import { getSessionIdFromCookie } from "@/lib/session";

// Rate limits — generous since we removed the per-user free cap.
// Spend-tracker auto-throttle kicks in if daily cost spikes.
const RATE_LIMIT_PER_IP = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    // 1. Rate limit by IP
    const rateCheck = checkRateLimit(
      `gen:${clientIP}`,
      RATE_LIMIT_PER_IP,
      RATE_LIMIT_WINDOW_MS
    );

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many generations. Please try again later.",
          retryAfter: Math.ceil((rateCheck.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateCheck.resetAt - Date.now()) / 1000)
            ),
          },
        }
      );
    }

    // 2. Check auto-throttle
    if (isThrottled()) {
      return NextResponse.json(
        {
          error:
            "We're experiencing high demand right now. Please try again in a few minutes!",
        },
        { status: 503 }
      );
    }

    const { image, styleId, customPrompt } = await request.json();

    if (!image || (!styleId && !customPrompt)) {
      return NextResponse.json(
        { error: "Missing image or style" },
        { status: 400 }
      );
    }

    // Handle custom prompt moderation
    let prompt: string;
    let resolvedStyleId: string;

    if (customPrompt) {
      const modResult = await moderatePrompt(customPrompt);
      if (!modResult.allowed) {
        return NextResponse.json(
          { error: "PROMPT_REJECTED", reason: modResult.reason },
          { status: 400 }
        );
      }
      prompt = `${customPrompt}. Sticker-ready with a clean outline edge and transparent background. Keep the person's face fully recognizable.`;
      resolvedStyleId = "custom";
    } else {
      const preset = stylePresets.find((p) => p.id === styleId);
      if (!preset && styleId !== "random" && styleId !== "custom") {
        return NextResponse.json(
          { error: "Invalid style preset" },
          { status: 400 }
        );
      }
      const resolved = resolvePresetPrompt(styleId);
      prompt = resolved.prompt;
      resolvedStyleId = resolved.resolvedId;
    }

    // Free generation is unlimited per user — abuse is controlled by:
    //   - Per-IP rate limit above (10/hour)
    //   - The spend-tracker auto-throttle when daily OpenAI cost spikes
    // This trades a generation-cost ceiling for the higher-conversion funnel
    // of letting people experiment freely until they fall in love with one.

    // 4. Generate the image (preview tier — fast)
    const styledImage = await generatePreview(image, prompt);

    // 5. Record generation + check spend alerts
    const { alert, stats } = recordGeneration("preview");
    if (alert) {
      sendAlert({
        level: alert.level as "info" | "warning" | "critical",
        title: `Daily Spend: $${stats.estimatedSpend.toFixed(2)}`,
        message: alert.message,
        stats: {
          "Generations today": stats.generations,
          "Estimated spend": `$${stats.estimatedSpend.toFixed(2)}`,
          "Errors today": stats.errors,
        },
      }).catch(() => {});
    }

    // 6. Tag with session ID for anonymous persistence
    const sessionId = getSessionIdFromCookie(
      request.headers.get("cookie")
    );

    return NextResponse.json({
      originalImage: image,
      generatedImage: styledImage,
      stylePreset: resolvedStyleId,
      sessionId,
    });
  } catch (error) {
    console.error("Generate error:", error);

    const errorMsg =
      error instanceof Error ? error.message : "Unknown generation error";
    const errorInfo = recordError(errorMsg);

    if (errorInfo.shouldAlert) {
      sendAlert({
        level: "error",
        title: "Generation Failed",
        message: errorMsg,
        stats: {
          "Error count today": errorInfo.errorCount,
        },
      }).catch(() => {});
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
