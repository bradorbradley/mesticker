import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

/**
 * Street mode orders: a guest scans the seller's QR, takes a selfie and pays
 * on their own phone; the seller's phone (/street/print) picks the order up,
 * builds the sheet and hands it to the Liene app.
 *
 * Kept apart from booth_queue on purpose, so the booth's print station never
 * claims a street order.
 *
 *   new → paid (Stripe confirmed) | cash (guest said they'll pay cash) | free (no Stripe set up)
 *       → printed (the seller tapped "Printed")
 *
 * Neon in production; without DATABASE_URL (local dev) it lives in memory.
 */

export const STREET_POSES = 7;
export const STREET_SHEET = "pose";

export type StreetPayment = "none" | "paid" | "cash" | "free";

export interface StreetOrder {
  id: string;
  /** short code the guest shows the seller, e.g. "K7" */
  code: string;
  checkoutId: string | null;
  payment: StreetPayment;
  photoUrl: string | null;
  mainUrl: string | null;
  /** 7 pose stickers (raw, transparent); null = not made yet */
  poses: (string | null)[];
  ideas: string[];
  printed: boolean;
  createdAt: string;
  paidAt: string | null;
  printedAt: string | null;
}

/** What anyone with the order id may see (the guest's own phone). */
export type StreetStatus = Pick<StreetOrder, "id" | "code" | "payment" | "printed" | "mainUrl" | "poses" | "ideas" | "photoUrl">;

/** Seller auth: STREET_KEY, or the print station's MCP_SECRET. Header `Authorization: Bearer …`. */
export function sellerAuthorized(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!key) return false;
  return [process.env.STREET_KEY, process.env.MCP_SECRET].some((secret) => {
    if (!secret) return false;
    const a = Buffer.from(key), b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
export const sellerKeyConfigured = () => !!(process.env.STREET_KEY || process.env.MCP_SECRET);

export const validId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(id);
export const validCode = (c: unknown): c is string => typeof c === "string" && /^[A-Z0-9]{2,4}$/.test(c);

/** Only images this app stored (Neon /api/images/… or Vercel Blob). */
export function okImageUrl(url: unknown): url is string {
  try {
    const u = new URL(String(url));
    if (u.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && u.hostname === "localhost")) return false;
    if (u.hostname.endsWith(".public.blob.vercel-storage.com")) return true;
    return /^\/api\/images\/[\w.-]{6,80}$/.test(u.pathname) && (u.hostname.endsWith("mesticker.fun") || u.hostname.endsWith(".vercel.app") || u.hostname === "localhost");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- storage

const inMemory = () => !process.env.DATABASE_URL;
function memory(): Map<string, StreetOrder> {
  const g = globalThis as { __streetOrders?: Map<string, StreetOrder> };
  return (g.__streetOrders ??= new Map());
}

let tableReady: Promise<unknown> | null = null;
function ensureTable() {
  if (!tableReady) {
    const sql = getDb();
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS street_orders (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        checkout_id TEXT,
        payment TEXT NOT NULL DEFAULT 'none',
        photo_url TEXT,
        main_url TEXT,
        poses JSONB NOT NULL DEFAULT '[]'::jsonb,
        ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
        printed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at TIMESTAMPTZ,
        printed_at TIMESTAMPTZ
      )
    `
      .then(() => sql`CREATE INDEX IF NOT EXISTS idx_street_orders_created ON street_orders(created_at)`)
      .catch((e) => {
        tableReady = null;
        throw e;
      });
  }
  return tableReady;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());
const json = <T>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  return (typeof v === "string" ? JSON.parse(v) : v) as T;
};
function fromRow(r: Row): StreetOrder {
  return {
    id: String(r.id),
    code: String(r.code),
    checkoutId: (r.checkout_id as string) ?? null,
    payment: (r.payment as StreetPayment) ?? "none",
    photoUrl: (r.photo_url as string) ?? null,
    mainUrl: (r.main_url as string) ?? null,
    poses: padPoses(json<(string | null)[]>(r.poses, [])),
    ideas: json<string[]>(r.ideas, []),
    printed: Boolean(r.printed),
    createdAt: iso(r.created_at)!,
    paidAt: iso(r.paid_at),
    printedAt: iso(r.printed_at),
  };
}

const padPoses = (p: (string | null)[]) => Array.from({ length: STREET_POSES }, (_, i) => p[i] ?? null);

export async function getOrder(id: string): Promise<StreetOrder | null> {
  if (inMemory()) {
    const o = memory().get(id);
    return o ? { ...o, poses: [...o.poses] } : null;
  }
  await ensureTable();
  const rows = await getDb()`SELECT * FROM street_orders WHERE id = ${id}`;
  return rows.length ? fromRow(rows[0] as Row) : null;
}

export interface OrderPatch {
  code?: string;
  photoUrl?: string;
  mainUrl?: string;
  /** sparse: only the slots given are filled, and only if still empty (or the seller replaces them) */
  poses?: (string | null)[];
  ideas?: string[];
}

/**
 * Create or fill in an order. A guest can only add stickers to an order that
 * hasn't printed yet, never mark it paid. `replace` (seller only) lets a
 * regenerated sticker overwrite an old one. Each field is written on its own
 * (poses slot by slot, in SQL), so stickers landing at the same moment never
 * overwrite each other.
 */
export async function upsertOrder(id: string, patch: OrderPatch, opts: { replace?: boolean } = {}): Promise<StreetOrder> {
  const replace = !!opts.replace;
  const ideas = patch.ideas?.slice(0, 9).map((s) => String(s).slice(0, 300));
  const poses = (patch.poses ?? []).map((p, i) => [i, p] as const).filter((e): e is readonly [number, string] => e[0] < STREET_POSES && !!e[1]);

  if (inMemory()) {
    const m = memory();
    let o = m.get(id);
    if (!o) {
      o = { id, code: patch.code ?? "??", checkoutId: null, payment: "none", photoUrl: null, mainUrl: null, poses: padPoses([]), ideas: [], printed: false, createdAt: new Date().toISOString(), paidAt: null, printedAt: null };
      m.set(id, o);
    }
    if (!o.printed) {
      // a retake (new photo) before paying starts the sticker, poses and ideas over
      if (patch.photoUrl && o.photoUrl && patch.photoUrl !== o.photoUrl && o.payment === "none" && !replace) Object.assign(o, { mainUrl: null, poses: padPoses([]), ideas: [] });
      if (patch.photoUrl && (!o.photoUrl || o.payment === "none" || replace)) o.photoUrl = patch.photoUrl;
      if (patch.mainUrl && (!o.mainUrl || o.payment === "none" || replace)) o.mainUrl = patch.mainUrl;
      for (const [i, url] of poses) if (!o.poses[i] || replace) o.poses[i] = url;
      if (ideas?.length && !o.ideas.length) o.ideas = ideas;
    }
    return { ...o, poses: [...o.poses] };
  }

  await ensureTable();
  const sql = getDb();
  await sql`
    INSERT INTO street_orders (id, code, poses) VALUES (${id}, ${patch.code ?? "??"}, ${JSON.stringify(padPoses([]))}::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
  if (patch.photoUrl) {
    if (!replace) {
      await sql`
        UPDATE street_orders SET main_url = NULL, poses = ${JSON.stringify(padPoses([]))}::jsonb, ideas = '[]'::jsonb
        WHERE id = ${id} AND NOT printed AND payment = 'none' AND photo_url IS NOT NULL AND photo_url <> ${patch.photoUrl}
      `;
    }
    await sql`UPDATE street_orders SET photo_url = ${patch.photoUrl} WHERE id = ${id} AND NOT printed AND (photo_url IS NULL OR payment = 'none' OR ${replace})`;
  }
  if (patch.mainUrl) {
    await sql`UPDATE street_orders SET main_url = ${patch.mainUrl} WHERE id = ${id} AND NOT printed AND (main_url IS NULL OR payment = 'none' OR ${replace})`;
  }
  for (const [i, url] of poses) {
    await sql`
      UPDATE street_orders SET poses = jsonb_set(poses, ARRAY[${String(i)}::text], to_jsonb(${url}::text))
      WHERE id = ${id} AND NOT printed AND (${replace} OR poses->>(${i}::int) IS NULL)
    `;
  }
  if (ideas?.length) {
    await sql`UPDATE street_orders SET ideas = ${JSON.stringify(ideas)}::jsonb WHERE id = ${id} AND jsonb_array_length(ideas) = 0`;
  }
  return (await getOrder(id))!;
}

export async function setCheckout(id: string, checkoutId: string) {
  if (inMemory()) {
    const o = memory().get(id);
    if (o) o.checkoutId = checkoutId;
    return;
  }
  await getDb()`UPDATE street_orders SET checkout_id = ${checkoutId} WHERE id = ${id}`;
}

/** Never downgrades: paid stays paid. */
export async function setPayment(id: string, payment: Exclude<StreetPayment, "none">) {
  if (inMemory()) {
    const o = memory().get(id);
    if (o && (o.payment === "none" || payment === "paid")) Object.assign(o, { payment, paidAt: o.paidAt ?? new Date().toISOString() });
    return;
  }
  await ensureTable();
  await getDb()`
    UPDATE street_orders SET payment = ${payment}, paid_at = COALESCE(paid_at, NOW())
    WHERE id = ${id} AND (payment = 'none' OR ${payment} = 'paid')
  `;
}

export async function setPrinted(id: string, printed: boolean) {
  if (inMemory()) {
    const o = memory().get(id);
    if (o) Object.assign(o, { printed, printedAt: printed ? new Date().toISOString() : null });
    return;
  }
  await ensureTable();
  await getDb()`UPDATE street_orders SET printed = ${printed}, printed_at = CASE WHEN ${printed} THEN NOW() ELSE NULL END WHERE id = ${id}`;
}

/** Recent orders that have a sticker (newest first). */
export async function recentOrders(hours = 12, limit = 60): Promise<StreetOrder[]> {
  if (inMemory()) {
    const since = Date.now() - hours * 3600_000;
    return [...memory().values()]
      .filter((o) => o.mainUrl && Date.parse(o.createdAt) > since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((o) => ({ ...o, poses: [...o.poses] }));
  }
  await ensureTable();
  const rows = await getDb()`
    SELECT * FROM street_orders
    WHERE main_url IS NOT NULL AND created_at > NOW() - make_interval(hours => ${hours})
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return (rows as Row[]).map(fromRow);
}

/**
 * Ask Stripe whether this order's checkout is paid (and is really this
 * order's), and record it. Never trusts the browser.
 */
export async function refreshPayment(o: StreetOrder): Promise<StreetOrder> {
  if (o.payment === "paid" || !o.checkoutId || !process.env.STRIPE_SECRET_KEY) return o;
  try {
    const s = await getStripe().checkout.sessions.retrieve(o.checkoutId);
    if (s.payment_status === "paid" && s.metadata?.source === "street" && s.metadata?.streetOrder === o.id) {
      await setPayment(o.id, "paid");
      return { ...o, payment: "paid", paidAt: o.paidAt ?? new Date().toISOString() };
    }
  } catch (e) {
    console.error("[street] Stripe check failed:", e);
  }
  return o;
}

export function publicStatus(o: StreetOrder): StreetStatus {
  return { id: o.id, code: o.code, payment: o.payment, printed: o.printed, mainUrl: o.mainUrl, poses: o.poses, ideas: o.ideas, photoUrl: o.photoUrl };
}
