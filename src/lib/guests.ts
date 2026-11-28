import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { getDb } from "@/lib/db";
import { saveImage } from "@/lib/image-store";
import { loadImageBuffer } from "@/lib/sheet-render";

/**
 * Event guests: who signed up at a booth event, what they agreed to, and what they made.
 *
 *   event_guests    one row per email (lowercased). Latest consent flags + a private token
 *                   (their gallery link and one-click unsubscribe). Unsubscribing never deletes.
 *   guest_consents  append-only log: every consent shown, the exact wording, yes/no, when,
 *                   IP and browser. The proof if anyone ever asks.
 *   guest_creations one row per order: original photo, every sticker, every sheet. Images are
 *                   copied to kind 'keep' (never pruned) when the guest agreed to the terms.
 *
 * In memory without DATABASE_URL (local dev / tests).
 */

export interface Guest {
  id: string;
  email: string;
  name: string | null;
  token: string;
  mediaConsent: boolean;
  marketingConsent: boolean;
  unsubscribedAt: string | null;
  createdAt: string;
  lastEvent: string | null;
}

export interface Creation {
  orderId: string;
  /** null until a guest claims it (made on the booth screen, claimed by scanning its QR) */
  guestId: string | null;
  event: string;
  photoUrl: string | null;
  stickerUrl: string | null;
  stickers: string[];
  sheets: string[];
  emailedAt: string | null;
  /** images copied and saved (the email waits for this) */
  ready: boolean;
  createdAt: string;
}

export interface ConsentInput {
  kind: "terms" | "media" | "marketing";
  given: boolean;
  text: string;
}

const mem = () => {
  const g = globalThis as { __guests?: { guests: Map<string, Guest>; creations: Map<string, Creation>; consents: unknown[] } };
  return (g.__guests ??= { guests: new Map(), creations: new Map(), consents: [] as unknown[] });
};
const inMemory = () => !process.env.DATABASE_URL;

let ready: Promise<unknown> | null = null;
function ensureTables() {
  if (!ready) {
    const sql = getDb();
    ready = sql`CREATE TABLE IF NOT EXISTS event_guests (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, token TEXT NOT NULL UNIQUE,
        media_consent BOOLEAN NOT NULL DEFAULT FALSE, marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
        unsubscribed_at TIMESTAMPTZ, last_event TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
      .then(() => sql`CREATE TABLE IF NOT EXISTS guest_consents (
        id BIGSERIAL PRIMARY KEY, guest_id TEXT NOT NULL, event TEXT, kind TEXT NOT NULL, given BOOLEAN NOT NULL,
        text TEXT NOT NULL, ip TEXT, user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
      .then(() => sql`CREATE TABLE IF NOT EXISTS guest_creations (
        order_id TEXT PRIMARY KEY, guest_id TEXT NOT NULL, event TEXT NOT NULL, photo_url TEXT, sticker_url TEXT,
        stickers JSONB NOT NULL DEFAULT '[]', sheets JSONB NOT NULL DEFAULT '[]', emailed_at TIMESTAMPTZ,
        ready BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
      .then(() => sql`ALTER TABLE guest_creations ALTER COLUMN guest_id DROP NOT NULL`)
      .then(() => sql`CREATE INDEX IF NOT EXISTS idx_guest_creations_guest ON guest_creations(guest_id)`)
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  return ready;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());
const json = <T,>(v: unknown, d: T): T => (typeof v === "string" ? JSON.parse(v) : (v as T) ?? d);
const guestFrom = (r: Row): Guest => ({
  id: String(r.id),
  email: String(r.email),
  name: (r.name as string) ?? null,
  token: String(r.token),
  mediaConsent: Boolean(r.media_consent),
  marketingConsent: Boolean(r.marketing_consent),
  unsubscribedAt: iso(r.unsubscribed_at),
  createdAt: iso(r.created_at)!,
  lastEvent: (r.last_event as string) ?? null,
});
const creationFrom = (r: Row): Creation => ({
  orderId: String(r.order_id),
  guestId: (r.guest_id as string) ?? null,
  event: String(r.event),
  photoUrl: (r.photo_url as string) ?? null,
  stickerUrl: (r.sticker_url as string) ?? null,
  stickers: json<string[]>(r.stickers, []),
  sheets: json<string[]>(r.sheets, []),
  emailedAt: iso(r.emailed_at),
  ready: Boolean(r.ready),
  createdAt: iso(r.created_at)!,
});

export const validEmail = (e: unknown): e is string => typeof e === "string" && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/**
 * Sign a guest up (or back in) at an event. Saving again updates their name and consent flags
 * (a "no" this time wins over an earlier "yes") and logs every consent shown.
 */
export async function signUpGuest(input: { email: string; name?: string | null; event: string; consents: ConsentInput[]; ip?: string | null; userAgent?: string | null }): Promise<Guest> {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim().slice(0, 80) || null;
  const media = input.consents.some((c) => c.kind === "media" && c.given);
  const marketing = input.consents.some((c) => c.kind === "marketing" && c.given);
  if (inMemory()) {
    const m = mem();
    const existing = [...m.guests.values()].find((g) => g.email === email);
    const g: Guest = existing
      ? { ...existing, name: name ?? existing.name, mediaConsent: media, marketingConsent: marketing, lastEvent: input.event, unsubscribedAt: marketing ? null : existing.unsubscribedAt }
      : { id: randomUUID(), email, name, token: randomBytes(18).toString("base64url"), mediaConsent: media, marketingConsent: marketing, unsubscribedAt: null, createdAt: new Date().toISOString(), lastEvent: input.event };
    m.guests.set(g.id, g);
    input.consents.forEach((c) => m.consents.push({ guestId: g.id, event: input.event, ...c, at: new Date().toISOString() }));
    return g;
  }
  await ensureTables();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO event_guests (id, email, name, token, media_consent, marketing_consent, last_event)
    VALUES (${randomUUID()}, ${email}, ${name}, ${randomBytes(18).toString("base64url")}, ${media}, ${marketing}, ${input.event})
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, event_guests.name),
      media_consent = EXCLUDED.media_consent,
      marketing_consent = EXCLUDED.marketing_consent,
      unsubscribed_at = CASE WHEN EXCLUDED.marketing_consent THEN NULL ELSE event_guests.unsubscribed_at END,
      last_event = EXCLUDED.last_event,
      updated_at = NOW()
    RETURNING *`;
  const g = guestFrom(rows[0] as Row);
  for (const c of input.consents) {
    await sql`INSERT INTO guest_consents (guest_id, event, kind, given, text, ip, user_agent)
      VALUES (${g.id}, ${input.event}, ${c.kind}, ${c.given}, ${c.text.slice(0, 2000)}, ${input.ip ?? null}, ${input.userAgent?.slice(0, 300) ?? null})`;
  }
  return g;
}

/** A guest by id, only if the token matches (the booth holds both after sign-up). */
export async function guestByIdToken(id: unknown, token: unknown): Promise<Guest | null> {
  if (typeof id !== "string" || typeof token !== "string" || token.length < 16) return null;
  if (inMemory()) {
    const g = mem().guests.get(id);
    return g && g.token === token ? g : null;
  }
  await ensureTables();
  const rows = await getDb()`SELECT * FROM event_guests WHERE id = ${id} AND token = ${token}`;
  return rows.length ? guestFrom(rows[0] as Row) : null;
}

export async function guestByToken(token: unknown): Promise<Guest | null> {
  if (typeof token !== "string" || token.length < 16 || token.length > 64) return null;
  if (inMemory()) return [...mem().guests.values()].find((g) => g.token === token) ?? null;
  await ensureTables();
  const rows = await getDb()`SELECT * FROM event_guests WHERE token = ${token}`;
  return rows.length ? guestFrom(rows[0] as Row) : null;
}

export async function countOrders(guestId: string, event: string): Promise<number> {
  if (inMemory()) return [...mem().creations.values()].filter((c) => c.guestId === guestId && c.event === event).length;
  await ensureTables();
  const [r] = await getDb()`SELECT COUNT(*)::int AS n FROM guest_creations WHERE guest_id = ${guestId} AND event = ${event}`;
  return Number(r.n);
}

export async function getCreation(orderId: string): Promise<Creation | null> {
  if (inMemory()) return mem().creations.get(orderId) ?? null;
  await ensureTables();
  const rows = await getDb()`SELECT * FROM guest_creations WHERE order_id = ${orderId}`;
  return rows.length ? creationFrom(rows[0] as Row) : null;
}

export async function creationsOf(guestId: string): Promise<Creation[]> {
  if (inMemory()) return [...mem().creations.values()].filter((c) => c.guestId === guestId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await ensureTables();
  const rows = await getDb()`SELECT * FROM guest_creations WHERE guest_id = ${guestId} ORDER BY created_at DESC`;
  return rows.map((r) => creationFrom(r as Row));
}

/** Copy an image to a kept, compact WebP (event images outlive the 14-day prune). */
async function keepCopy(url: string): Promise<string> {
  const src = await loadImageBuffer(url);
  const webp = await sharp(src).rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toBuffer();
  return saveImage(webp, "image/webp", "keep");
}

/**
 * Hold a spot for this order right away (so the per-guest limit counts it even while its images
 * are still being copied). Returns false if it was already there (the booth can resend a kit).
 */
export async function claimCreation(orderId: string, guestId: string | null, event: string): Promise<boolean> {
  if (inMemory()) {
    const m = mem();
    if (m.creations.has(orderId)) return false;
    m.creations.set(orderId, { orderId, guestId, event, photoUrl: null, stickerUrl: null, stickers: [], sheets: [], emailedAt: null, ready: false, createdAt: new Date().toISOString() });
    return true;
  }
  await ensureTables();
  const rows = await getDb()`INSERT INTO guest_creations (order_id, guest_id, event) VALUES (${orderId}, ${guestId}, ${event}) ON CONFLICT (order_id) DO NOTHING RETURNING order_id`;
  return rows.length > 0;
}

/** Copy the order's images to kept storage and save them on its record. */
export async function fillCreation(orderId: string, input: { photoUrl: string | null; stickerUrl: string | null; stickers: string[]; sheets: string[] }): Promise<Creation> {
  const copy = async (u: string | null) => (u ? keepCopy(u).catch((e) => (console.error("[guests] keep copy failed:", e), u)) : null);
  const [photoUrl, stickerUrl, stickers, sheets] = await Promise.all([
    copy(input.photoUrl),
    copy(input.stickerUrl),
    Promise.all([...new Set(input.stickers)].slice(0, 40).map((u) => copy(u) as Promise<string>)),
    Promise.all(input.sheets.slice(0, 3).map((u) => copy(u) as Promise<string>)),
  ]);
  if (inMemory()) {
    const c = mem().creations.get(orderId)!;
    Object.assign(c, { photoUrl, stickerUrl, stickers, sheets, ready: true });
    return c;
  }
  const rows = await getDb()`
    UPDATE guest_creations SET photo_url = ${photoUrl}, sticker_url = ${stickerUrl}, stickers = ${JSON.stringify(stickers)}::jsonb,
      sheets = ${JSON.stringify(sheets)}::jsonb, ready = TRUE
    WHERE order_id = ${orderId} RETURNING *`;
  return creationFrom(rows[0] as Row);
}

/**
 * A guest claims a creation (they scanned the booth's QR for this order). Only an unclaimed one,
 * or their own. Returns it, or null.
 */
export async function attachGuest(orderId: string, guestId: string): Promise<Creation | null> {
  if (inMemory()) {
    const c = mem().creations.get(orderId);
    if (!c || (c.guestId && c.guestId !== guestId)) return null;
    c.guestId = guestId;
    return c;
  }
  await ensureTables();
  const rows = await getDb()`UPDATE guest_creations SET guest_id = ${guestId} WHERE order_id = ${orderId} AND (guest_id IS NULL OR guest_id = ${guestId}) RETURNING *`;
  return rows.length ? creationFrom(rows[0] as Row) : null;
}

export async function getGuest(id: string): Promise<Guest | null> {
  if (inMemory()) return mem().guests.get(id) ?? null;
  await ensureTables();
  const rows = await getDb()`SELECT * FROM event_guests WHERE id = ${id}`;
  return rows.length ? guestFrom(rows[0] as Row) : null;
}

export async function markEmailed(orderId: string) {
  if (inMemory()) {
    const c = mem().creations.get(orderId);
    if (c) c.emailedAt = new Date().toISOString();
    return;
  }
  await getDb()`UPDATE guest_creations SET emailed_at = NOW() WHERE order_id = ${orderId}`;
}

export async function pendingEmails(limit = 50): Promise<{ guest: Guest; creation: Creation }[]> {
  if (inMemory()) {
    const m = mem();
    return [...m.creations.values()].filter((c) => !c.emailedAt && c.ready && c.guestId).slice(0, limit).map((c) => ({ creation: c, guest: m.guests.get(c.guestId!)! })).filter((x) => x.guest);
  }
  await ensureTables();
  const rows = await getDb()`
    SELECT c.*, g.id AS g_id, g.email, g.name, g.token, g.media_consent, g.marketing_consent, g.unsubscribed_at, g.last_event, g.created_at AS g_created_at
    FROM guest_creations c JOIN event_guests g ON g.id = c.guest_id
    WHERE c.emailed_at IS NULL AND c.ready ORDER BY c.created_at LIMIT ${limit}`;
  return rows.map((r) => ({ creation: creationFrom(r as Row), guest: guestFrom({ ...(r as Row), id: r.g_id, created_at: r.g_created_at }) }));
}

export async function unsubscribe(token: string): Promise<Guest | null> {
  const g = await guestByToken(token);
  if (!g) return null;
  if (inMemory()) {
    Object.assign(mem().guests.get(g.id)!, { marketingConsent: false, unsubscribedAt: new Date().toISOString() });
  } else {
    await getDb()`UPDATE event_guests SET marketing_consent = FALSE, unsubscribed_at = NOW(), updated_at = NOW() WHERE id = ${g.id}`;
    await getDb()`INSERT INTO guest_consents (guest_id, kind, given, text) VALUES (${g.id}, 'marketing', FALSE, 'Unsubscribed with the link in an email')`;
  }
  return { ...g, marketingConsent: false, unsubscribedAt: new Date().toISOString() };
}

/** Everyone, with how many orders they made (admin export). */
export async function listGuests(): Promise<(Guest & { orders: number; events: string[] })[]> {
  if (inMemory()) {
    const m = mem();
    return [...m.guests.values()].map((g) => {
      const cs = [...m.creations.values()].filter((c) => c.guestId === g.id);
      return { ...g, orders: cs.length, events: [...new Set(cs.map((c) => c.event))] };
    });
  }
  await ensureTables();
  const rows = await getDb()`
    SELECT g.*, COUNT(c.order_id)::int AS orders, COALESCE(array_agg(DISTINCT c.event) FILTER (WHERE c.event IS NOT NULL), '{}') AS events
    FROM event_guests g LEFT JOIN guest_creations c ON c.guest_id = g.id
    GROUP BY g.id ORDER BY g.created_at DESC`;
  return rows.map((r) => ({ ...guestFrom(r as Row), orders: Number(r.orders), events: (r.events as string[]) ?? [] }));
}
