import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import type { QueueItem } from "@/lib/booth-queue";
import { getOrder, okImageUrl, refreshPayment, validId } from "@/lib/street-orders";
import { queueStreetOrder } from "@/lib/street-print";

/**
 * Send a paid street order to the print station.
 *
 *   POST { id, guide, items: [{ n, url, x, y, w, h }] } → { queued, already? }
 *
 * The phone that sends it (the guest's, or the seller's as a backup) has
 * already given every sticker its white die-cut border and worked out its
 * spot on the sheet, same as the booth does. Payment is checked on the server.
 * Only the first kit for an order counts.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SLOTS = 12;

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`street-kit:${getClientIP(request)}`, 60, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({}));
    if (!validId(body.id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    const found = await getOrder(body.id);
    if (!found) return NextResponse.json({ error: "No such order" }, { status: 404 });
    const order = await refreshPayment(found);
    if (order.queuedAt) return NextResponse.json({ queued: true, already: true });
    if (order.payment === "none") return NextResponse.json({ error: "Not paid yet" }, { status: 402 });
    if (!okImageUrl(body.guide)) return NextResponse.json({ error: "Bad guide" }, { status: 400 });
    if (!Array.isArray(body.items) || body.items.length !== SLOTS) return NextResponse.json({ error: "Bad kit" }, { status: 400 });

    const inches = (v: unknown, max: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : null;
    };
    const items: QueueItem[] = [];
    for (const [i, it] of (body.items as Record<string, unknown>[]).entries()) {
      const x = inches(it.x, 3.9), y = inches(it.y, 6.7), w = inches(it.w, 3.9), h = inches(it.h, 6.7);
      if (!okImageUrl(it.url) || x == null || y == null || !w || !h) return NextResponse.json({ error: `Bad sticker ${i + 1}` }, { status: 400 });
      items.push({ sheet: 0, n: i + 1, url: it.url, x, y, w, h });
    }

    const envOrigin = process.env.NEXT_PUBLIC_APP_URL;
    const origin = envOrigin && !envOrigin.includes("localhost") ? envOrigin.replace(/\/$/, "") : request.nextUrl.origin;
    await queueStreetOrder(order, body.guide, items, origin);
    return NextResponse.json({ queued: true });
  } catch (e) {
    console.error("[street/kit] failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't send to the printer" }, { status: 500 });
  }
}
