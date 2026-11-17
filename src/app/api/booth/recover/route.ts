import { NextRequest, NextResponse } from "next/server";
import { stationAuthorized } from "@/lib/booth-queue";
import { getStripe } from "@/lib/stripe";

/**
 * Station-only recovery: recent paid booth checkouts and recently uploaded
 * sticker images, so the station can rebuild an order that was paid but never
 * reached the queue. Auth: the station key (MCP_SECRET).
 *
 *   GET ?minutes=90 → { sessions: [{ id, sheets, amount, created }], images: [{ url, uploadedAt, size }] }
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!process.env.MCP_SECRET) return NextResponse.json({ error: "Set MCP_SECRET" }, { status: 503 });
  if (!stationAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const minutes = Math.min(24 * 60, Math.max(5, Number(request.nextUrl.searchParams.get("minutes")) || 90));
  const since = Math.floor(Date.now() / 1000) - minutes * 60;
  const out: { sessions: unknown[]; images: unknown[]; errors: string[] } = { sessions: [], images: [], errors: [] };
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const list = await getStripe().checkout.sessions.list({ created: { gte: since }, limit: 50 });
      out.sessions = list.data
        .filter((s) => s.metadata?.source === "booth" && s.payment_status === "paid")
        .map((s) => ({ id: s.id, sheets: s.metadata?.sheets, amount: s.amount_total, created: new Date(s.created * 1000).toISOString() }));
    } catch (e) {
      out.errors.push(`stripe: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (process.env.DATABASE_URL) {
    try {
      const { listRecent } = await import("@/lib/image-store");
      out.images = await listRecent("sticker", since);
    } catch (e) {
      out.errors.push(`images: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (process.env.BLOB_READ_WRITE_TOKEN && !out.images.length) {
    try {
      const { list } = await import("@vercel/blob");
      const res = await list({ prefix: "sticker-", limit: 1000, token: process.env.BLOB_READ_WRITE_TOKEN });
      out.images = res.blobs
        .filter((b) => b.uploadedAt.getTime() / 1000 >= since)
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
        .map((b) => ({ url: b.url, uploadedAt: b.uploadedAt.toISOString(), size: b.size }));
    } catch (e) {
      out.errors.push(`blob: ${e instanceof Error ? e.message : e}`);
    }
  }
  return NextResponse.json(out);
}
