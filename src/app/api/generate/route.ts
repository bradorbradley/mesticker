import { NextRequest, NextResponse } from "next/server";
import { generateStickerImage } from "@/lib/openai";
import { stylePresets, resolvePresetPrompt } from "@/lib/presets";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { recordGeneration, recordError, isThrottled } from "@/lib/spend-tracker";
import { sendAlert } from "@/lib/alerts";

const FREE_GENERATION_LIMIT = 3;

// Rate limits
const RATE_LIMIT_PER_IP = 10; // max generations per IP per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    // 1. Rate limit by IP — hard cap regardless of auth status
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

    // 2. Check if auto-throttled due to daily spend
    if (isThrottled()) {
      return NextResponse.json(
        {
          error:
            "We're experiencing high demand right now. Please try again in a few minutes!",
        },
        { status: 503 }
      );
    }

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

    // 3. Enforce generation limit for signed-in users (server-side)
    if (process.env.DATABASE_URL) {
      const session = await auth();
      if (session?.user?.id) {
        const sql = getDb();
        const [countRow] = await sql`
          SELECT COUNT(*)::int AS count FROM creations WHERE user_id = ${session.user.id}
        `;
        const [orderRow] = await sql`
          SELECT COUNT(*)::int AS count FROM orders WHERE user_id = ${session.user.id}
        `;
        const creationCount = countRow?.count ?? 0;
        const hasOrdered = (orderRow?.count ?? 0) > 0;

        if (creationCount >= FREE_GENERATION_LIMIT && !hasOrdered) {
          return NextResponse.json(
            { error: "FREE_LIMIT_REACHED" },
            { status: 403 }
          );
        }
      }
    }

    // Resolve the prompt (handles "random" by picking a random real style)
    const { prompt } = resolvePresetPrompt(styleId);

    // 4. Generate the image
    const styledImage = await generateStickerImage(image, prompt);

    // 5. Record generation + check spend alerts
    const { alert, stats } = recordGeneration();
    if (alert) {
      // Fire and forget — don't block the response
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

    return NextResponse.json({
      originalImage: image,
      generatedImage: styledImage,
      stylePreset: styleId,
    });
  } catch (error) {
    console.error("Generate error:", error);

    // Record error + alert if needed
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
