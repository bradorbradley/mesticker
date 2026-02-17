import { NextRequest, NextResponse } from "next/server";
import { generateStickerImage } from "@/lib/openai";
import { stylePresets, resolvePresetPrompt } from "@/lib/presets";
import { uploadImage } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

// TODO: Re-enable generation limit once order tracking is reliable
const FREE_GENERATION_LIMIT = Infinity;

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

    // Enforce generation limit for signed-in users (server-side)
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

    // OpenAI gpt-image-1 handles style transfer + transparent background in one call
    const styledImage = await generateStickerImage(image, prompt);

    // Pre-upload to blob storage so the order API doesn't need base64
    let imageUrl: string | undefined;
    try {
      imageUrl = await uploadImage(styledImage);
    } catch (e) {
      console.error("Image upload failed (non-fatal):", e);
    }

    return NextResponse.json({
      originalImage: image,
      generatedImage: styledImage,
      stylePreset: styleId,
      imageUrl,
    });
  } catch (error) {
    console.error("Generate error:", error);

    // Detect OpenAI safety system rejections and return a friendly message
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("safety system") ||
      message.includes("content_policy") ||
      message.includes("rejected")
    ) {
      return NextResponse.json(
        {
          error: "This photo couldn't be processed. Try a different photo or style — sometimes simply retrying works too!",
          code: "SAFETY_REJECTION",
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
