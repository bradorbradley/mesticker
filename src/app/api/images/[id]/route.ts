import { NextRequest, NextResponse } from "next/server";
import { getImage } from "@/lib/image-store";

/**
 * Serves stored images (Neon, see src/lib/image-store.ts) and, in development,
 * the in-memory fallback. Ids are unique per upload, so responses are immutable
 * and the CDN caches them: each image is read from the database about once.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cache = { "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" };

  if (process.env.DATABASE_URL) {
    try {
      const img = await getImage(id);
      if (img) return new NextResponse(new Uint8Array(img.data), { headers: { "Content-Type": img.contentType, ...cache } });
    } catch (e) {
      console.error("[images] read failed:", e);
      return NextResponse.json({ error: "Image store unavailable" }, { status: 503 });
    }
  }

  const devImages = (globalThis as Record<string, unknown>).__devImages as Record<string, string> | undefined;
  const match = devImages?.[id]?.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(match[2], "base64")), { headers: { "Content-Type": match[1], ...cache } });
}
