import { getDb } from "@/lib/db";

/**
 * Event settings shared by every booth device and guest phone, set from /booth/admin.
 *
 * `free`: a prepaid event. The booth skips payment everywhere, and orders made while it's
 * on are marked paid by the server (so the print station prints them). Turning it off ends
 * that: orders without a card payment never print again.
 *
 * One row in Neon; in memory without DATABASE_URL (local dev).
 */
export interface BoothEvent {
  free: boolean;
  updatedAt: string | null;
}

const OFF: BoothEvent = { free: false, updatedAt: null };
const g = globalThis as { __boothEvent?: BoothEvent };

let ready: Promise<unknown> | null = null;
function ensureTable() {
  ready ??= getDb()`CREATE TABLE IF NOT EXISTS booth_event (id INT PRIMARY KEY, free BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`.catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export async function getEvent(): Promise<BoothEvent> {
  if (!process.env.DATABASE_URL) return g.__boothEvent ?? OFF;
  await ensureTable();
  const rows = await getDb()`SELECT free, updated_at FROM booth_event WHERE id = 1`;
  if (!rows.length) return OFF;
  return { free: Boolean(rows[0].free), updatedAt: new Date(rows[0].updated_at as string).toISOString() };
}

export async function setEvent(patch: { free: boolean }): Promise<BoothEvent> {
  if (!process.env.DATABASE_URL) return (g.__boothEvent = { free: patch.free, updatedAt: new Date().toISOString() });
  await ensureTable();
  await getDb()`INSERT INTO booth_event (id, free, updated_at) VALUES (1, ${patch.free}, NOW()) ON CONFLICT (id) DO UPDATE SET free = EXCLUDED.free, updated_at = NOW()`;
  return getEvent();
}

/** Never let a settings hiccup take payments down: on error, act as a paid event. */
export const isFreeEvent = () => getEvent().then((e) => e.free, () => false);
