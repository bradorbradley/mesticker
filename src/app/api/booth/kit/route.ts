import { NextRequest, NextResponse } from "next/server";
import { uploadJson } from "@/lib/storage";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { enqueue, type QueueItem } from "@/lib/booth-queue";
import { getStripe } from "@/lib/stripe";
import { DEFAULT_PRODUCT_ID, getProduct } from "@/lib/booth-config";

/**
 * A Liene kit: the numbered sheet guide + the 8 images (already uploaded),
 * saved as a small JSON file so staff can open it on the phone that runs the
 * Liene app (/booth/kit?m=…) and save the images to Photos.
 *
 * When the booth sends `order` too, the kit also goes on the print queue
 * (/api/booth/queue) for the print station.
 */

const isHosted = (url: unknown): url is string => {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && (u.hostname.endsWith(".public.blob.vercel-storage.com") || u.hostname.endsWith("mesticker.fun"));
  } catch {
    return false;
  }
};
const isLocal = (url: unknown) => process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?\//.test(String(url));
const okUrl = (url: unknown): url is string => isHosted(url) || isLocal(url);

/**
 * Put a paid order on the print queue. Payment is checked with Stripe here,
 * never taken from the browser: orders without a paid booth Checkout Session
 * (free mode, cash) are queued as unverified, and the station only prints
 * those when told to. Never blocks the kit itself.
 */
async function queueOrder(order: { id?: unknown; productId?: unknown; checkoutId?: unknown }, kitUrl: string, guideUrl: string | null, items: QueueItem[]) {
  const id = String(order?.id ?? "");
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) return false;
  const checkoutId = typeof order.checkoutId === "string" && order.checkoutId.startsWith("cs_") ? order.checkoutId : null;
  const productId = getProduct(String(order.productId ?? ""))?.id ?? DEFAULT_PRODUCT_ID;
  let verified = false;
  if (checkoutId && process.env.STRIPE_SECRET_KEY) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(checkoutId);
      verified = session.payment_status === "paid" && session.metadata?.source === "booth";
    } catch (e) {
      console.error("[booth/kit] Stripe check failed:", e);
    }
  }
  try {
    await enqueue({ id, boothId: process.env.BOOTH_ID || "booth-1", productId, checkoutId, verified, kitUrl, guideUrl, items });
    return true;
  } catch (e) {
    console.error("[booth/kit] enqueue failed:", e);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`booth-kit:${getClientIP(request)}`, 200, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  try {
    const { guide, items, order } = await request.json();
    if (!Array.isArray(items) || !items.length || items.length > 16) return NextResponse.json({ error: "Bad kit" }, { status: 400 });
    const clean: QueueItem[] = items.map((it: { n?: unknown; url?: unknown; w?: unknown; h?: unknown }, i: number) => {
      if (!okUrl(it.url)) throw new Error("Bad image URL");
      return { n: Number(it.n) || i + 1, url: it.url, w: Number(it.w) || 0, h: Number(it.h) || 0 };
    });
    const guideUrl = okUrl(guide) ? guide : null;
    const manifest = await uploadJson({ kind: "mesticker-liene-kit", created: Date.now(), guide: guideUrl, items: clean });
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const url = `${origin}/booth/kit?m=${encodeURIComponent(manifest)}`;
    const queued = order ? await queueOrder(order, url, guideUrl, clean) : false;
    return NextResponse.json({ url, queued });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kit failed" }, { status: 400 });
  }
}
