/**
 * Image storage in Neon Postgres (the database the app already uses), served
 * at /api/images/<id>. Replaces Vercel Blob, so stickers cost nothing extra.
 *
 * Neon's free tier is 0.5 GB, so old images are pruned: anything older than
 * RETENTION_DAYS, and the oldest first whenever the table grows past MAX_MB.
 * Orders print within minutes of payment, well inside that window.
 */
import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";

const RETENTION_DAYS = Number(process.env.IMAGE_RETENTION_DAYS) || 14;
const MAX_MB = Number(process.env.IMAGE_STORE_MAX_MB) || 350;

let ready: Promise<unknown> | null = null;
function ensureTable() {
  ready ??= getDb()`
    CREATE TABLE IF NOT EXISTS stored_images (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      content_type TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
    .then(() => getDb()`CREATE INDEX IF NOT EXISTS idx_stored_images_kind_created ON stored_images(kind, created_at)`)
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

/** Public base URL for image links (the station and Stripe fetch these). */
export function publicBase() {
  if (process.env.IMAGE_PUBLIC_BASE) return process.env.IMAGE_PUBLIC_BASE.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production") return "https://mesticker.fun";
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/json": "json", "video/mp4": "mp4", "audio/wav": "wav", "audio/mpeg": "mp3", "audio/mp3": "mp3" };

/** Store bytes; returns the public URL. `kind` groups them ("sticker", "cart", "photo"). */
export async function saveImage(buf: Buffer, contentType: string, kind: string): Promise<string> {
  await ensureTable();
  const id = `${kind}-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${EXT[contentType] ?? "bin"}`;
  await getDb()`INSERT INTO stored_images (id, kind, content_type, bytes, data) VALUES (${id}, ${kind}, ${contentType}, ${buf.length}, ${"\\x" + buf.toString("hex")}::bytea)`;
  // prune now and then (about 1 upload in 20), never blocking the caller
  if (Math.random() < 0.05) prune().catch((e) => console.error("[image-store] prune failed:", e));
  return `${publicBase()}/api/images/${id}`;
}

export async function getImage(id: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!/^[\w.-]{6,80}$/.test(id)) return null;
  await ensureTable();
  const rows = await getDb()`SELECT content_type, encode(data, 'base64') AS b64 FROM stored_images WHERE id = ${id}`;
  if (!rows.length) return null;
  return { data: Buffer.from(rows[0].b64 as string, "base64"), contentType: rows[0].content_type as string };
}

/** Recent images of a kind (station recovery: stickers uploaded around a payment). */
export async function listRecent(kind: string, sinceSeconds: number) {
  await ensureTable();
  const rows = await getDb()`
    SELECT id, bytes, created_at FROM stored_images
    WHERE kind = ${kind} AND created_at >= to_timestamp(${sinceSeconds})
    ORDER BY created_at DESC LIMIT 1000`;
  return rows.map((r) => ({ url: `${publicBase()}/api/images/${r.id}`, uploadedAt: new Date(r.created_at as string).toISOString(), size: Number(r.bytes) }));
}

/** Delete stored images by their public URLs (a guest asking to be forgotten). */
export async function deleteImages(urls: string[]) {
  const ids = urls.map((u) => u.split("/api/images/")[1]).filter((id): id is string => !!id && /^[\w.-]{6,80}$/.test(id));
  if (!ids.length || !process.env.DATABASE_URL) return;
  await ensureTable();
  await getDb()`DELETE FROM stored_images WHERE id = ANY(${ids})`;
}

export async function prune() {
  await ensureTable();
  const sql = getDb();
  // kind 'keep' = event guests' photos and stickers, kept until they ask us to delete them
  await sql`DELETE FROM stored_images WHERE kind <> 'keep' AND created_at < NOW() - make_interval(days => ${RETENTION_DAYS})`;
  const [{ total }] = await sql`SELECT COALESCE(SUM(bytes), 0)::bigint AS total FROM stored_images WHERE kind <> 'keep'`;
  let over = Number(total) - MAX_MB * 1024 * 1024;
  if (over <= 0) return;
  // drop the oldest until under the cap
  const old = await sql`SELECT id, bytes FROM stored_images WHERE kind <> 'keep' ORDER BY created_at LIMIT 500`;
  const ids: string[] = [];
  for (const r of old) {
    if (over <= 0) break;
    ids.push(r.id as string);
    over -= Number(r.bytes);
  }
  if (ids.length) await sql`DELETE FROM stored_images WHERE id = ANY(${ids})`;
}
