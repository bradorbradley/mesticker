import { NextRequest, NextResponse } from "next/server";

/**
 * Dev-only fallback image serving endpoint.
 * In production, images are served from Vercel Blob.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const devImages = (globalThis as Record<string, unknown>).__devImages as
    | Record<string, string>
    | undefined;

  const dataUrl = devImages?.[id];
  if (!dataUrl) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid image data" }, { status: 500 });
  }

  const [, contentType, base64Data] = match;
  const buffer = Buffer.from(base64Data, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
