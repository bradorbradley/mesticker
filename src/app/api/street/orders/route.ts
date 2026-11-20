import { NextRequest, NextResponse } from "next/server";
import { getOrder, okImageUrl, recentOrders, refreshPayment, sellerAuthorized, sellerKeyConfigured, setCollected, setPrinted, upsertOrder, validId } from "@/lib/street-orders";
import { releaseToStation, reprint, streetQueue } from "@/lib/street-print";

/**
 * The seller's phone (/street/print). Auth: `Authorization: Bearer <STREET_KEY or MCP_SECRET>`.
 *
 *   GET → { orders }: the last 12 hours, newest first. Stripe is asked about
 *         any checkout not yet confirmed. Orders still being made (not paid)
 *         come back too, as "making", so the seller sees who's mid-selfie.
 *   Each order carries `queue`: where it is on the print station (null until it's sent).
 *   POST { id, action: "collected" } → cash in hand: the station may print it now
 *   POST { id, action: "reprint" } → put it back on the print station
 *   POST { id, action: "printed" | "unprinted" }
 *   POST { id, action: "stickers", mainUrl?, poses? } → save stickers the seller's phone made (fills gaps or replaces)
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function guard(request: NextRequest) {
  if (!sellerKeyConfigured()) return NextResponse.json({ error: "Street mode is off: set STREET_KEY in Vercel" }, { status: 503 });
  if (!sellerAuthorized(request)) return NextResponse.json({ error: "Wrong key" }, { status: 401 });
  return null;
}

export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    const list = await recentOrders();
    // only ask Stripe about the newest unconfirmed checkouts, to stay fast
    let asks = 0;
    const fresh = await Promise.all(list.map((o) => (o.payment === "none" && o.checkoutId && asks++ < 8 ? refreshPayment(o) : o)));
    const orders = await Promise.all(
      fresh.map(async (o) => {
        const queue = await streetQueue(o);
        return { ...o, printed: o.printed || queue?.status === "done", queue };
      })
    );
    return NextResponse.json({ orders, serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[street/orders] list failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "List failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    if (!validId(body.id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    const order = await getOrder(body.id);
    if (!order) return NextResponse.json({ error: "No such order" }, { status: 404 });
    if (body.action === "collected") {
      if (order.payment !== "cash") return NextResponse.json({ error: "Not a cash order" }, { status: 400 });
      await setCollected(body.id);
      await releaseToStation({ ...order, collected: true });
      return NextResponse.json({ order: await getOrder(body.id) });
    }
    if (body.action === "reprint") {
      if (!order.queuedAt) return NextResponse.json({ error: "Not sent to the printer yet" }, { status: 400 });
      await reprint(body.id);
      await setPrinted(body.id, false);
      return NextResponse.json({ order: await getOrder(body.id) });
    }
    if (body.action === "printed" || body.action === "unprinted") {
      await setPrinted(body.id, body.action === "printed");
      return NextResponse.json({ order: await getOrder(body.id) });
    }
    if (body.action === "stickers") {
      const mainUrl = okImageUrl(body.mainUrl) ? body.mainUrl : undefined;
      const poses = Array.isArray(body.poses) ? body.poses.slice(0, 7).map((p: unknown) => (okImageUrl(p) ? p : null)) : undefined;
      return NextResponse.json({ order: await upsertOrder(body.id, { mainUrl, poses }, { replace: true }) });
    }
    return NextResponse.json({ error: "action must be collected, reprint, printed, unprinted or stickers" }, { status: 400 });
  } catch (e) {
    console.error("[street/orders] update failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 500 });
  }
}
