import { timingSafeEqual, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { addOrder, listOrders, removeOrder, stationKey } from "@/lib/booth-queue";
import { getProduct } from "@/lib/booth-config";
import { getStripe } from "@/lib/stripe";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

/**
 *   POST { kitUrl, guide, productId, sessionId? } → { code }   a guest's sheet joins the queue
 *   GET  ?key=…                                   → { orders } the station's view
 *   DELETE ?key=…&id=…                            → done (printed)
 */

function staff(request: NextRequest) {
  const secret = stationKey();
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const a = Buffer.from(key), b = Buffer.from(secret);
  return !!secret && a.length === b.length && timingSafeEqual(a, b);
}

const ourKitLink = (url: unknown): url is string => {
  try {
    const u = new URL(String(url));
    const m = new URL(u.searchParams.get("m") ?? "");
    return u.pathname === "/booth/kit" && (m.hostname.endsWith(".public.blob.vercel-storage.com") || (process.env.NODE_ENV !== "production" && m.hostname === "localhost"));
  } catch {
    return false;
  }
};

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`booth-queue:${getClientIP(request)}`, 60, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  try {
    const { kitUrl, guide, productId, sessionId } = await request.json();
    if (!ourKitLink(kitUrl)) return NextResponse.json({ error: "Bad kit" }, { status: 400 });
    const product = getProduct(productId);
    if (!product) return NextResponse.json({ error: "Bad product" }, { status: 400 });

    // paid = Stripe says so; anything else (free mode, staff comp) shows as unpaid on the station
    let paid = false;
    if (typeof sessionId === "string" && sessionId.startsWith("cs_") && process.env.STRIPE_SECRET_KEY) {
      const s = await getStripe().checkout.sessions.retrieve(sessionId).catch(() => null);
      paid = s?.payment_status === "paid" && s.metadata?.productId === product.id;
    }
    const code = String(100 + (randomBytes(2).readUInt16BE() % 900));
    await addOrder({
      id: randomBytes(6).toString("hex"),
      code,
      created: Date.now(),
      productId: product.id,
      productName: product.name,
      kitUrl,
      guide: typeof guide === "string" && /^https?:\/\//.test(guide) ? guide : null,
      paid,
    });
    return NextResponse.json({ code });
  } catch (error) {
    console.error("[booth/queue]", error);
    return NextResponse.json({ error: "Couldn't reach the printer queue" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!stationKey()) return NextResponse.json({ error: "Set BOOTH_STATION_KEY to use the station" }, { status: 503 });
  if (!staff(request)) return NextResponse.json({ error: "Wrong station key" }, { status: 401 });
  return NextResponse.json({ orders: await listOrders() }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest) {
  if (!staff(request)) return NextResponse.json({ error: "Wrong station key" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f0-9]{12}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await removeOrder(id);
  return NextResponse.json({ ok: true });
}
