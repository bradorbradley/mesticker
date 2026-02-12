/**
 * Image storage utilities.
 *
 * In production this uploads to Vercel Blob for a public URL.
 * In development (no BLOB_READ_WRITE_TOKEN), it falls back to
 * a local dev endpoint that serves base64 images.
 */

export async function uploadImage(base64DataUrl: string): Promise<string> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (blobToken) {
    // Production: upload to Vercel Blob
    const { put } = await import("@vercel/blob");
    const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const filename = `sticker-${Date.now()}.png`;

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "image/png",
      token: blobToken,
    });

    return blob.url;
  }

  // Dev fallback: store in-memory and serve via local API
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Store in global map for the dev image endpoint
  (globalThis as Record<string, unknown>).__devImages =
    (globalThis as Record<string, unknown>).__devImages || {};
  ((globalThis as Record<string, unknown>).__devImages as Record<string, string>)[id] = base64DataUrl;

  return `${appUrl}/api/images/${id}`;
}
