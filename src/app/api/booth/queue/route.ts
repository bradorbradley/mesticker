import { NextRequest, NextResponse } from "next/server";
import { claimNext, finish, listOrders, stationAuthorized, type QueueStatus } from "@/lib/booth-queue";

/**
 * Print queue for the booth's print station (the Mac next to the PixCut).
 * Auth: the station key (MCP_SECRET) as `Authorization: Bearer …` or `?key=…`.
 *
 *   GET  ?status=queued|printing|done|failed   → { orders }   (no status: latest 50)
 *   POST { action: "claim", boothId?, includeUnverified? } → { order | null }
 *   POST { action: "done" | "failed" | "requeue", id, error? } → { order }
 *
 * Orders are added by /api/booth/kit when the booth shows a paid order's kit.
 * "claim" only returns Stripe-verified orders unless includeUnverified is true
 * (free mode / cash orders), so a stranger posting kits can't burn paper.
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
