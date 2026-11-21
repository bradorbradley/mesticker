import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";

/**
 * Booth print queue. Every paid booth order lands here (enqueued by
 * /api/booth/kit), and the print station on the Mac pulls them from
 * /api/booth/queue with the station key (MCP_SECRET).
 *
 *   queued → printing (claimed by the station) → done | failed
 *
 * While an order is "printing" the station reports a finer `stage`
 * ("preparing" → "printing" once Print & Cut is pressed), which the guest's
 * screen shows as a live progress bar (/api/booth/order-status).
 *
 * A "printing" order that isn't finished within STALE_MINUTES goes back to
 * the front of the line, so a crashed station never loses an order.
 *
 * Neon in production; without DATABASE_URL (local dev) it lives in memory.
 */

export type QueueStatus = "queued" | "printing" | "done" | "failed";
export type QueueStage = "preparing" | "printing";
export const QUEUE_STAGES: QueueStage[] = ["preparing", "printing"];

/** One sticker placement: on which sheet (0-based), slot n, where and how big (inches from the printable area's top-left). */
export interface QueueItem {
  n: number;
  url: string;
  w: number;
  h: number;
  sheet?: number;
  x?: number;
  y?: number;
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
  /** numbered guide per sheet, in sheet order */
  guides: string[];
  items: QueueItem[];
  attempts: number;
  error: string | null;
  createdAt: string;
  claimedAt: string | null;
  doneAt: string | null;
  stage: QueueStage | null;
  stageAt: string | null;
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
      .then(() => sql`ALTER TABLE booth_queue ADD COLUMN IF NOT EXISTS guides JSONB`)
      .then(() => sql`ALTER TABLE booth_queue ADD COLUMN IF NOT EXISTS stage TEXT`)
      .then(() => sql`ALTER TABLE booth_queue ADD COLUMN IF NOT EXISTS stage_at TIMESTAMPTZ`)
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
    guides: ((typeof r.guides === "string" ? JSON.parse(r.guides) : r.guides) as string[] | null) ?? (r.guide_url ? [String(r.guide_url)] : []),
    items: (typeof r.items === "string" ? JSON.parse(r.items) : r.items) as QueueItem[],
    attempts: Number(r.attempts) || 0,
    error: (r.error as string) ?? null,
    createdAt: iso(r.created_at)!,
    claimedAt: iso(r.claimed_at),
    doneAt: iso(r.done_at),
    stage: (r.stage as QueueStage) ?? null,
    stageAt: iso(r.stage_at),
  };
}

// ---------------------------------------------------------------- operations

/**
 * Add an order. Same id again (the booth re-sends it with every sticker
 * drawn, or once paid) upgrades it to verified (never back) and, while it's
 * still queued, replaces its kit with the newer one.
 */
export async function enqueue(o: Pick<QueueOrder, "id" | "boothId" | "productId" | "checkoutId" | "verified" | "kitUrl" | "guideUrl" | "guides" | "items">) {
  if (inMemory()) {
    const m = memory();
    const had = m.get(o.id);
    if (had) {
      had.verified ||= o.verified;
      // a fuller kit (all sheet stickers drawn) replaces the quick one while it's still waiting
      if (had.status === "queued") Object.assign(had, { kitUrl: o.kitUrl, guideUrl: o.guideUrl, guides: o.guides, items: o.items });
    }
    else m.set(o.id, { ...o, status: "queued", attempts: 0, error: null, createdAt: new Date().toISOString(), claimedAt: null, doneAt: null, stage: null, stageAt: null });
    return;
  }
  await ensureTable();
  await getDb()`
    INSERT INTO booth_queue (id, booth_id, product_id, checkout_id, verified, kit_url, guide_url, guides, items)
    VALUES (${o.id}, ${o.boothId}, ${o.productId}, ${o.checkoutId}, ${o.verified}, ${o.kitUrl}, ${o.guideUrl}, ${JSON.stringify(o.guides)}::jsonb, ${JSON.stringify(o.items)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      verified = booth_queue.verified OR EXCLUDED.verified,
      -- the booth sends a quick kit as soon as there's a checkout, then the full one once
      -- every sheet sticker is drawn; take the newer one until the station claims it
      kit_url = CASE WHEN booth_queue.status = 'queued' THEN EXCLUDED.kit_url ELSE booth_queue.kit_url END,
      guide_url = CASE WHEN booth_queue.status = 'queued' THEN EXCLUDED.guide_url ELSE booth_queue.guide_url END,
      guides = CASE WHEN booth_queue.status = 'queued' THEN EXCLUDED.guides ELSE booth_queue.guides END,
      items = CASE WHEN booth_queue.status = 'queued' THEN EXCLUDED.items ELSE booth_queue.items END
  `;
}

/** Queued orders with a Stripe checkout that isn't confirmed paid yet (last 2 hours). */
export async function awaitingPayment(): Promise<Pick<QueueOrder, "id" | "checkoutId" | "productId">[]> {
  if (inMemory()) {
    const since = Date.now() - 2 * 3600_000;
    return [...memory().values()].filter((o) => o.status === "queued" && !o.verified && o.checkoutId && Date.parse(o.createdAt) > since);
  }
  await ensureTable();
  const rows = await getDb()`
    SELECT id, checkout_id, product_id FROM booth_queue
    WHERE status = 'queued' AND NOT verified AND checkout_id IS NOT NULL AND created_at > NOW() - INTERVAL '2 hours'
    ORDER BY created_at LIMIT 20
  `;
  return (rows as Row[]).map((r) => ({ id: r.id as string, checkoutId: r.checkout_id as string, productId: r.product_id as string }));
}

export async function markVerified(id: string) {
  if (inMemory()) {
    const o = memory().get(id);
    if (o) o.verified = true;
    return;
  }
  await getDb()`UPDATE booth_queue SET verified = TRUE WHERE id = ${id}`;
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
 * "printing" one). Unverified orders (free mode / cash) only when asked;
 * an unpaid Stripe checkout never.
 */
export async function claimNext(boothId: string | null, includeUnverified: boolean): Promise<QueueOrder | null> {
  if (inMemory()) {
    const staleBefore = Date.now() - STALE_MINUTES * 60_000;
    const next = [...memory().values()]
      .filter((o) => (!boothId || o.boothId === boothId) && (o.verified || (includeUnverified && !o.checkoutId)))
      .filter((o) => o.status === "queued" || (o.status === "printing" && Date.parse(o.claimedAt ?? "") < staleBefore))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!next) return null;
    const now = new Date().toISOString();
    Object.assign(next, { status: "printing", claimedAt: now, attempts: next.attempts + 1, stage: "preparing", stageAt: now });
    return { ...next };
  }
  await ensureTable();
  const rows = await getDb()`
    UPDATE booth_queue SET status = 'printing', claimed_at = NOW(), attempts = attempts + 1, stage = 'preparing', stage_at = NOW()
    WHERE id = (
      SELECT id FROM booth_queue
      WHERE (status = 'queued' OR (status = 'printing' AND claimed_at < NOW() - make_interval(mins => ${STALE_MINUTES})))
        AND (${boothId}::text IS NULL OR booth_id = ${boothId})
        AND (verified OR (${includeUnverified} AND checkout_id IS NULL))
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

/** Station reports progress on an order it's printing (see QueueStage). */
export async function setStage(id: string, stage: QueueStage): Promise<boolean> {
  if (inMemory()) {
    const o = memory().get(id);
    if (!o || o.status !== "printing") return false;
    Object.assign(o, { stage, stageAt: new Date().toISOString() });
    return true;
  }
  await ensureTable();
  const rows = await getDb()`
    UPDATE booth_queue SET stage = ${stage}, stage_at = NOW()
    WHERE id = ${id} AND status = 'printing'
    RETURNING id
  `;
  return rows.length > 0;
}

/** What the guest's screen needs, nothing more: where their order is and how many are ahead. */
export interface OrderProgress {
  status: QueueStatus;
  stage: QueueStage | null;
  stageAt: string | null;
  verified: boolean;
  /** paid orders still in line before this one */
  ahead: number;
  sheets: number;
  serverTime: string;
}

export async function orderProgress(id: string): Promise<OrderProgress | null> {
  const sheetsOf = (productId: string) => Math.max(1, productId.split("+").filter(Boolean).length);
  if (inMemory()) {
    const o = memory().get(id);
    if (!o) return null;
    const ahead = [...memory().values()].filter((x) => x.verified && (x.status === "queued" || x.status === "printing") && x.createdAt < o.createdAt).length;
    return { status: o.status, stage: o.stage, stageAt: o.stageAt, verified: o.verified, ahead, sheets: sheetsOf(o.productId), serverTime: new Date().toISOString() };
  }
  await ensureTable();
  const rows = await getDb()`
    SELECT o.status, o.stage, o.stage_at, o.verified, o.product_id,
      (SELECT COUNT(*) FROM booth_queue x
        WHERE x.verified AND x.status IN ('queued', 'printing') AND x.created_at < o.created_at AND x.booth_id = o.booth_id) AS ahead
    FROM booth_queue o WHERE o.id = ${id}
  `;
  if (!rows.length) return null;
  const r = rows[0] as Row;
  return {
    status: r.status as QueueStatus,
    stage: (r.stage as QueueStage) ?? null,
    stageAt: iso(r.stage_at),
    verified: Boolean(r.verified),
    ahead: Number(r.ahead) || 0,
    sheets: sheetsOf(String(r.product_id)),
    serverTime: new Date().toISOString(),
  };
}
