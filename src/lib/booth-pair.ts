/**
 * Booth ↔ guest phone pairing ("Take from mobile").
 *
 * The booth laptop shows a QR with a random code. The guest's phone opens
 * /booth/snap?p=<code>, takes a selfie or picks a photo, and sends it here.
 * The laptop (which makes the stickers and builds the print order) picks the
 * photo up and publishes what it's showing (step, picked sheets, pay link…);
 * the phone shows the same and can change the sheets or pay. Both poll.
 *
 * One Neon row per code. Rows older than 3 hours are deleted: photos of guests
 * aren't kept.
 */
import { getDb } from "@/lib/db";

export type LaptopState = {
  step: string;
  picked: string[];
  /** the bordered main sticker, once made */
  sticker: string | null;
  /** Stripe checkout for exactly `payFor` sheets */
  payUrl: string | null;
  payFor: string | null;
  freeMode: boolean;
  paid: boolean;
};

export type PhoneState = {
  /** guest changed the sheets on the phone; `seq` increases with every change */
  picked?: string[];
  seq?: number;
  /** free mode: guest tapped Print on the phone */
  print?: number;
};

export type Pair = {
  code: string;
  photoAt: string | null;
  connectedAt: string | null;
  laptop: LaptopState | null;
  phone: PhoneState | null;
};

export const validCode = (c: unknown): c is string => typeof c === "string" && /^[a-z0-9]{8,24}$/.test(c);

let ready: Promise<unknown> | null = null;
function ensureTable() {
  ready ??= getDb()`
    CREATE TABLE IF NOT EXISTS booth_pair (
      code TEXT PRIMARY KEY,
      photo TEXT,
      photo_at TIMESTAMPTZ,
      connected_at TIMESTAMPTZ,
      laptop JSONB,
      phone JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`.catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export async function getPair(code: string): Promise<Pair | null> {
  await ensureTable();
  const rows = await getDb()`
    SELECT code, photo_at, connected_at, laptop, phone FROM booth_pair
    WHERE code = ${code} AND created_at > NOW() - INTERVAL '3 hours'`;
  if (!rows.length) return null;
  const r = rows[0];
  return { code, photoAt: iso(r.photo_at), connectedAt: iso(r.connected_at), laptop: (r.laptop as LaptopState) ?? null, phone: (r.phone as PhoneState) ?? null };
}

export async function getPhoto(code: string): Promise<string | null> {
  await ensureTable();
  const rows = await getDb()`SELECT photo FROM booth_pair WHERE code = ${code} AND created_at > NOW() - INTERVAL '3 hours'`;
  return (rows[0]?.photo as string | undefined) ?? null;
}

async function upsert(code: string) {
  await ensureTable();
  const sql = getDb();
  await sql`INSERT INTO booth_pair (code) VALUES (${code}) ON CONFLICT (code) DO NOTHING`;
  // tidy up now and then
  if (Math.random() < 0.1) sql`DELETE FROM booth_pair WHERE created_at < NOW() - INTERVAL '3 hours'`.catch(() => {});
}

export async function setLaptop(code: string, state: LaptopState) {
  await upsert(code);
  await getDb()`UPDATE booth_pair SET laptop = ${JSON.stringify(state)}::jsonb WHERE code = ${code}`;
}

export async function markConnected(code: string) {
  await upsert(code);
  await getDb()`UPDATE booth_pair SET connected_at = NOW() WHERE code = ${code}`;
}

export async function setPhoto(code: string, photo: string) {
  await upsert(code);
  await getDb()`UPDATE booth_pair SET photo = ${photo}, photo_at = NOW(), connected_at = COALESCE(connected_at, NOW()) WHERE code = ${code}`;
}

export async function updatePhone(code: string, patch: PhoneState) {
  await upsert(code);
  await getDb()`UPDATE booth_pair SET phone = COALESCE(phone, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb WHERE code = ${code}`;
}
