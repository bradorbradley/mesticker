import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";

/**
 * Booth print queue. Every paid booth order lands here (enqueued by
 * /api/booth/kit), and the print station on the Mac pulls them from
 * /api/booth/queue with the station key (MCP_SECRET).
 *
 *   queued → printing (claimed by the station) → done | failed
 *
 * A "printing" order that isn't finished within STALE_MINUTES goes back to
 * the front of the line, so a crashed station never loses an order.
 *
 * Neon in production; without DATABASE_URL (local dev) it lives in memory.
 */

export type QueueStatus = "queued" | "printing" | "done" | "failed";

export interface QueueItem {
  n: number;
  url: string;
  w: number;
  h: number;
}

export interface QueueOrder {
  id: string;
  boothId: string;
  productId: string;
  checkoutId: string | null;
  /** true when Stripe confirmed payment; false for free mode / cash */
  verified: boolean;
  status: QueueStatus;
  kitUrl: string;
  guideUrl: string | null;
  items: QueueItem[];
  attempts: number;
  error: string | null;
  createdAt: string;
  claimedAt: string | null;
  doneAt: string | null;
}

export const STALE_MINUTES = 15;

/** Station auth: `Authorization: Bearer <MCP_SECRET>` or `?key=<MCP_SECRET>`. */
export function stationAuthorized(req: Request) {
  const secret = process.env.MCP_SECRET;
  if (!secret) return false;
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("key") ?? "";
  const a = Buffer.from(key), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------- storage

const inMemory = () => !process.env.DATABASE_URL;

function memory(): Map<string, QueueOrder> {
  const g = globalThis as { __boothQueue?: Map<string, QueueOrder> };
  return (g.__boothQueue ??= new Map());
}

let tableReady: Promise<unknown> | null = null;
function ensureTable() {
  if (!tableReady) {
    const sql = getDb();
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS booth_queue (
        id TEXT PRIMARY KEY,
        booth_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        checkout_id TEXT,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'queued',
        kit_url TEXT NOT NULL,
        guide_url TEXT,
        items JSONB NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        claimed_at TIMESTAMPTZ,
        done_at TIMESTAMPTZ
      )
    `
      .then(() => sql`CREATE INDEX IF NOT EXISTS idx_booth_queue_status ON booth_queue(status, created_at)`)
      .catch((e) => {
        tableReady = null;
        throw e;
      });
  }
  return tableReady;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());
function fromRow(r: Row): QueueOrder {
  return {
    id: String(r.id),
    boothId: String(r.booth_id),
    productId: String(r.product_id),
    checkoutId: (r.checkout_id as string) ?? null,
    verified: Boolean(r.verified),
    status: r.status as QueueStatus,
    kitUrl: String(r.kit_url),
    guideUrl: (r.guide_url as string) ?? null,
    items: (typeof r.items === "string" ? JSON.parse(r.items) : r.items) as QueueItem[],
    attempts: Number(r.attempts) || 0,
    error: (r.error as string) ?? null,
    createdAt: iso(r.created_at)!,
    claimedAt: iso(r.claimed_at),
    doneAt: iso(r.done_at),
  };
}

// ---------------------------------------------------------------- operations

/** Add a paid order. Same id twice (e.g. staff reopens the kit) is a no-op. */
export async function enqueue(o: Pick<QueueOrder, "id" | "boothId" | "productId" | "checkoutId" | "verified" | "kitUrl" | "guideUrl" | "items">) {
  if (inMemory()) {
    const m = memory();
    if (!m.has(o.id)) {
      m.set(o.id, { ...o, status: "queued", attempts: 0, error: null, createdAt: new Date().toISOString(), claimedAt: null, doneAt: null });
    }
    return;
  }
  await ensureTable();
  await getDb()`
    INSERT INTO booth_queue (id, booth_id, product_id, checkout_id, verified, kit_url, guide_url, items)
    VALUES (${o.id}, ${o.boothId}, ${o.productId}, ${o.checkoutId}, ${o.verified}, ${o.kitUrl}, ${o.guideUrl}, ${JSON.stringify(o.items)}::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
}

/** Orders, oldest first. */
export async function listOrders(status?: QueueStatus, limit = 50): Promise<QueueOrder[]> {
  if (inMemory()) {
    return [...memory().values()]
      .filter((o) => !status || o.status === status)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }
  await ensureTable();
  const rows = status
    ? await getDb()`SELECT * FROM booth_queue WHERE status = ${status} ORDER BY created_at LIMIT ${limit}`
    : await getDb()`SELECT * FROM booth_queue ORDER BY created_at DESC LIMIT ${limit}`;
  return (rows as Row[]).map(fromRow);
}

/**
 * Hand the station the next order to print (oldest queued, or a stale
 * "printing" one). Unverified orders (free mode / cash) only when asked.
 */
export async function claimNext(boothId: string | null, includeUnverified: boolean): Promise<QueueOrder | null> {
  if (inMemory()) {
    const staleBefore = Date.now() - STALE_MINUTES * 60_000;
    const next = [...memory().values()]
      .filter((o) => (!boothId || o.boothId === boothId) && (includeUnverified || o.verified))
      .filter((o) => o.status === "queued" || (o.status === "printing" && Date.parse(o.claimedAt ?? "") < staleBefore))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!next) return null;
    Object.assign(next, { status: "printing", claimedAt: new Date().toISOString(), attempts: next.attempts + 1 });
    return { ...next };
  }
  await ensureTable();
  const rows = await getDb()`
    UPDATE booth_queue SET status = 'printing', claimed_at = NOW(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM booth_queue
      WHERE (status = 'queued' OR (status = 'printing' AND claimed_at < NOW() - make_interval(mins => ${STALE_MINUTES})))
        AND (${boothId}::text IS NULL OR booth_id = ${boothId})
        AND (verified OR ${includeUnverified})
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
  return rows.length ? fromRow(rows[0] as Row) : null;
}

/** Station reports back: done, failed (with why), or put it back in line. */
export async function finish(id: string, outcome: "done" | "failed" | "requeue", error?: string): Promise<QueueOrder | null> {
  const status: QueueStatus = outcome === "requeue" ? "queued" : outcome;
  const err = outcome === "failed" ? (error || "failed").slice(0, 500) : null;
  if (inMemory()) {
    const o = memory().get(id);
    if (!o) return null;
    Object.assign(o, { status, error: err, doneAt: outcome === "requeue" ? null : new Date().toISOString(), claimedAt: outcome === "requeue" ? null : o.claimedAt });
    return { ...o };
  }
  await ensureTable();
  const rows = await getDb()`
    UPDATE booth_queue SET
      status = ${status},
      error = ${err},
      done_at = CASE WHEN ${outcome} = 'requeue' THEN NULL ELSE NOW() END,
      claimed_at = CASE WHEN ${outcome} = 'requeue' THEN NULL ELSE claimed_at END
    WHERE id = ${id}
    RETURNING *
  `;
  return rows.length ? fromRow(rows[0] as Row) : null;
}
