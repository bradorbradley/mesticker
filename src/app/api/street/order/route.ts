import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { getOrder, okImageUrl, publicStatus, refreshPayment, setPayment, upsertOrder, validCode, validId, type StreetOrder } from "@/lib/street-orders";
import { releaseToStation, streetQueue } from "@/lib/street-print";

/**
 * The guest's phone in street mode.
 *
 *   GET  ?id=<order uuid>  → the order's status (payment, where it is on the print station) and its stickers
 *   POST { id, code?, photoUrl?, mainUrl?, poses?, ideas? } → save stickers as they're made
 *   POST { id, action: "cash" } → the guest will pay the seller in cash
 *
 * Public on purpose: order ids are random UUIDs, and a guest can never mark an
 * order paid. Stripe payment is checked on the server (refreshPayment).
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!validId(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  try {
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await withQueue(await refreshPayment(order)), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[street/order] get failed:", e);
    return NextResponse.json({ error: "Status unavailable" }, { status: 500 });
  }
}

/** The guest's view, with the print station's progress folded in. */
async function withQueue(o: StreetOrder) {
  let queue = await streetQueue(o);
  if (queue && !queue.verified && (o.payment === "paid" || o.collected)) {
    await releaseToStation(o);
    queue = { ...queue, verified: true };
  }
  return { ...publicStatus(o), printed: o.printed || queue?.status === "done", queue };
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`street-order:${getClientIP(request)}`, 400, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({}));
    if (!validId(body.id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    if (body.action === "cash") {
      const order = await getOrder(body.id);
      if (!order?.mainUrl) return NextResponse.json({ error: "No sticker yet" }, { status: 400 });
      await setPayment(body.id, "cash");
      return NextResponse.json(publicStatus((await getOrder(body.id))!));
    }

    const url = (v: unknown) => (v == null ? undefined : okImageUrl(v) ? v : null);
    const photoUrl = url(body.photoUrl), mainUrl = url(body.mainUrl);
    if (photoUrl === null || mainUrl === null) return NextResponse.json({ error: "Bad image URL" }, { status: 400 });
    const poses = Array.isArray(body.poses) ? body.poses.slice(0, 7).map((p: unknown) => (okImageUrl(p) ? p : null)) : undefined;
    const ideas = Array.isArray(body.ideas) ? body.ideas.filter((s: unknown) => typeof s === "string") : undefined;
    const order = await upsertOrder(body.id, { code: validCode(body.code) ? body.code : undefined, photoUrl, mainUrl, poses, ideas });
    return NextResponse.json(publicStatus(order));
  } catch (e) {
    console.error("[street/order] save failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed" }, { status: 500 });
  }
}
