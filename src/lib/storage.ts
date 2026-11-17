/**
 * Image storage utilities.
 *
 * Production: images live in Neon Postgres (src/lib/image-store.ts) and are
 * served at https://mesticker.fun/api/images/<id>. Set IMAGE_STORE=blob to use
 * Vercel Blob instead (needs BLOB_READ_WRITE_TOKEN).
 * Development without DATABASE_URL: an in-memory store served by the same route.
 */
import { saveImage } from "@/lib/image-store";

type Store = "neon" | "blob" | "dev";
function store(): Store {
  if (process.env.IMAGE_STORE === "blob" && process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.DATABASE_URL) return "neon";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "dev";
}

function devSave(dataUrl: string, prefix: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const g = globalThis as Record<string, unknown>;
  const map = (g.__devImages = (g.__devImages as Record<string, string>) || {}) as Record<string, string>;
  map[id] = dataUrl;
  return `${appUrl}/api/images/${id}`;
}

/**
 * Upload an arbitrary JSON payload and return its public URL.
 * Used to store cart-item data (with prompts, source URLs) too large for
 * Stripe metadata's 500-char-per-value limit.
 */
export async function uploadJson(payload: unknown): Promise<string> {
  const json = JSON.stringify(payload);
  const s = store();
  if (s === "neon") return saveImage(Buffer.from(json), "application/json", "cart");
  if (s === "blob") {
    const { put } = await import("@vercel/blob");
    const filename = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    const blob = await put(filename, json, { access: "public", contentType: "application/json", token: process.env.BLOB_READ_WRITE_TOKEN });
    return blob.url;
  }
  return devSave(`data:application/json;base64,${Buffer.from(json).toString("base64")}`, "dev-cart");
}

export async function uploadImage(base64DataUrl: string): Promise<string> {
  const m = base64DataUrl.match(/^data:(image\/\w+);base64,/);
  const contentType = m?.[1] ?? "image/png";
  const buffer = Buffer.from(base64DataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const s = store();
  // "sticker" = PNG stickers (station recovery looks these up); "photo" = everything else
  if (s === "neon") return saveImage(buffer, contentType, contentType === "image/png" ? "sticker" : "photo");
  if (s === "blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(`sticker-${Date.now()}.png`, buffer, { access: "public", contentType: "image/png", token: process.env.BLOB_READ_WRITE_TOKEN });
    return blob.url;
  }
  return devSave(base64DataUrl, "dev");
}
