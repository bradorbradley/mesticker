import { NextRequest, NextResponse } from "next/server";
import { awaitingPayment, claimNext, finish, listOrders, markVerified, stationAuthorized, type QueueStatus } from "@/lib/booth-queue";
import { checkoutPaid } from "@/lib/booth-payment";

/**
 * Print queue for the booth's print station (the Mac next to the PixCut).
 * Auth: the station key (MCP_SECRET) as `Authorization: Bearer …` or `?key=…`.
 *
 *   GET  ?status=queued|printing|done|failed   → { orders }   (no status: latest 50)
 *   POST { action: "claim", boothId?, includeUnverified? } → { order | null }
 *   POST { action: "done" | "failed" | "requeue", id, error? } → { order }
 *
 * Orders are added by /api/booth/kit as soon as the booth has a checkout
 * (unpaid), and "claim" asks Stripe whether those have been paid since. It
 * only returns Stripe-verified orders, plus no-checkout ones (free mode / cash)
 * when includeUnverified is true, so a stranger posting kits can't burn paper.
 */

export const dynamic = "force-dynamic";

const STATUSES: QueueStatus[] = ["queued", "printing", "done", "failed"];

function guard(request: NextRequest) {
  if (!process.env.MCP_SECRET) return NextResponse.json({ error: "Queue is off: set MCP_SECRET" }, { status: 503 });
  if (!stationAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  const status = request.nextUrl.searchParams.get("status") as QueueStatus | null;
  if (status && !STATUSES.includes(status)) return NextResponse.json({ error: "Bad status" }, { status: 400 });
  try {
    return NextResponse.json({ orders: await listOrders(status ?? undefined) });
  } catch (e) {
    console.error("[booth/queue] list failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Queue failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "");
    if (action === "claim") {
      const boothId = body.boothId ? String(body.boothId) : null;
      // orders sent before payment: ask Stripe whether they've been paid since
      const pending = await awaitingPayment();
      await Promise.all(pending.map(async (o) => o.checkoutId && (await checkoutPaid(o.checkoutId, o.productId)) && markVerified(o.id)));
      return NextResponse.json({ order: await claimNext(boothId, body.includeUnverified === true) });
    }
    if (action === "done" || action === "failed" || action === "requeue") {
      if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
      const order = await finish(String(body.id), action, body.error ? String(body.error) : undefined);
      if (!order) return NextResponse.json({ error: "No such order" }, { status: 404 });
      return NextResponse.json({ order });
    }
    return NextResponse.json({ error: "action must be claim, done, failed or requeue" }, { status: 400 });
  } catch (e) {
    console.error("[booth/queue] failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Queue failed" }, { status: 500 });
  }
}
