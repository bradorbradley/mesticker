/**
 * The print queue: guests make and pay for sheets on any device (their own
 * phone, the touchscreen laptop, a tablet), and each paid sheet lands here.
 * The staff phone that runs the Liene app watches it at /booth/station,
 * opens each order's Liene kit, prints, and marks it done.
 *
 * Stored as one small JSON file per order in Vercel Blob (in memory in dev).
 */

export interface QueueOrder {
  id: string;
  code: string; // 3-digit pickup number shown to the guest
  created: number;
  productId: string;
  productName: string;
  kitUrl: string; // /booth/kit?m=… (images to upload into the Liene app)
  guide: string | null; // numbered sheet preview
  paid: boolean; // verified with Stripe; false = free mode / staff comp
}

const PREFIX = "booth-queue/";
type Mem = Map<string, QueueOrder>;
const mem = (): Mem => (((globalThis as Record<string, unknown>).__boothQueue ??= new Map()) as Mem);
const token = () => process.env.BLOB_READ_WRITE_TOKEN;

export async function addOrder(order: QueueOrder) {
  const t = token();
  if (!t) return void mem().set(order.id, order);
  const { put } = await import("@vercel/blob");
  await put(`${PREFIX}${order.created}-${order.id}.json`, JSON.stringify(order), {
    access: "public",
    contentType: "application/json",
    token: t,
    addRandomSuffix: true, // the URL is unguessable; only the station key can list it
  });
}

export async function listOrders(): Promise<QueueOrder[]> {
  const t = token();
  if (!t) return [...mem().values()].sort((a, b) => a.created - b.created);
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: PREFIX, token: t, limit: 100 });
  const orders = await Promise.all(
    blobs.map(async (b) => {
      try {
        const o = (await (await fetch(b.url, { cache: "no-store" })).json()) as QueueOrder;
        return o?.id ? o : null;
      } catch {
        return null;
      }
    })
  );
  return orders.filter((o): o is QueueOrder => !!o).sort((a, b) => a.created - b.created);
}

export async function removeOrder(id: string) {
  const t = token();
  if (!t) return void mem().delete(id);
  const { list, del } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: PREFIX, token: t, limit: 100 });
  const hit = blobs.filter((b) => b.pathname.includes(`-${id}`));
  if (hit.length) await del(hit.map((b) => b.url), { token: t });
}

/** Station access: BOOTH_STATION_KEY, falling back to MCP_SECRET. */
export function stationKey() {
  return process.env.BOOTH_STATION_KEY || process.env.MCP_SECRET || "";
}
