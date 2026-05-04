/**
 * Image storage utilities.
 *
 * In production this uploads to Vercel Blob for a public URL.
 * In development (no BLOB_READ_WRITE_TOKEN), it falls back to
 * a local dev endpoint that serves base64 images.
 */

/**
 * Upload an arbitrary JSON payload to Blob and return its public URL.
 * Used to store cart-item data (with prompts, source URLs) too large for
 * Stripe metadata's 500-char-per-value limit.
 */
export async function uploadJson(payload: unknown): Promise<string> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const json = JSON.stringify(payload);

  if (blobToken) {
    const { put } = await import("@vercel/blob");
    const filename = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    const blob = await put(filename, json, {
      access: "public",
      contentType: "application/json",
      token: blobToken,
    });
    return blob.url;
  }

  // Dev fallback: store in-memory and serve via local API
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const id = `dev-cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const map = ((globalThis as Record<string, unknown>).__devImages =
    ((globalThis as Record<string, unknown>).__devImages as Record<string, string>) || {});
  (map as Record<string, string>)[id] = `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
  return `${appUrl}/api/images/${id}`;
}

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
