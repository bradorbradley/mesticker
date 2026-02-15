import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { uploadImage } from "@/lib/storage";

// GET /api/creations — list the current user's creations
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sql = getDb();
  const rows = await sql`
    SELECT id, original_image_url, generated_image_url, style_preset, ordered, created_at
    FROM creations
    WHERE user_id = ${session.user.id}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const creations = rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    originalImage: r.original_image_url,
    generatedImage: r.generated_image_url,
    stylePreset: r.style_preset,
    ordered: r.ordered,
  }));

  return NextResponse.json(creations);
}

// POST /api/creations — save a new creation
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { originalImage, generatedImage, stylePreset } = await request.json();

  if (!originalImage || !generatedImage || !stylePreset) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Upload both images to blob storage to get persistent URLs
  const [originalUrl, generatedUrl] = await Promise.all([
    uploadImage(originalImage),
    uploadImage(generatedImage),
  ]);

  const id = `cr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const sql = getDb();
  await sql`
    INSERT INTO creations (id, user_id, original_image_url, generated_image_url, style_preset)
    VALUES (${id}, ${session.user.id}, ${originalUrl}, ${generatedUrl}, ${stylePreset})
  `;

  return NextResponse.json({
    id,
    createdAt: new Date().toISOString(),
    originalImage: originalUrl,
    generatedImage: generatedUrl,
    stylePreset,
    ordered: false,
  });
}
