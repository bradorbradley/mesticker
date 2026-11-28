import { NextRequest, NextResponse, after } from "next/server";
import { getPartyEvent } from "@/lib/party-events";
import { claimCreation, countOrders, fillCreation, getCreation, guestByIdToken, markEmailed } from "@/lib/guests";
import { guestEmailReady, sendGuestEmail } from "@/lib/guest-email";
import { isFreeEvent } from "@/lib/booth-event";
import { uploadJson } from "@/lib/storage";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { enqueue, type QueueItem } from "@/lib/booth-queue";
import { checkoutPaid } from "@/lib/booth-payment";
import { parseSheets } from "@/lib/booth-config";

/**
 * A Liene kit: the numbered sheet guide + the 8 images (already uploaded),
 * saved as a small JSON file so staff can open it on the phone that runs the
 * Liene app (/booth/kit?m=…) and save the images to Photos.
 *
 * When the booth sends `order` too, the kit also goes on the print queue
 * (/api/booth/queue) for the print station: every sticker placement
 * ({ sheet, n, url, x, y, w, h } in inches) plus a numbered guide per sheet.
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
 * Put an order on the print queue. Payment is checked with Stripe here,
 * never taken from the browser. The booth sends each order as soon as its
 * checkout exists (unpaid), then again once it sees the payment; the queue
 * re-checks Stripe for unpaid ones when the station asks for work, so an
 * order prints even if the booth tab never sees the payment. Orders with no
 * checkout (free mode, cash) are unverified and print only when the station
 * is told to. Never blocks the kit itself.
 */
type OrderIn = {
  id?: unknown;
  sheets?: unknown;
  checkoutId?: unknown;
  /** event booth link (src/lib/party-events.ts) and the signed-up guest */
  event?: unknown;
  guest?: { id?: unknown; token?: unknown };
  photoUrl?: unknown;
  stickerUrl?: unknown;
  sheetUrls?: unknown;
};

/** A booked event's order: free if the event is, saved to the guest's record, emailed once. */
async function eventOrder(order: OrderIn, id: string, items: QueueItem[]): Promise<boolean> {
  const event = getPartyEvent(order.event);
  if (!event) return false;
  const guest = await guestByIdToken(order.guest?.id, order.guest?.token);
  if (!guest) return false;
  // the limit counts orders already held; a resend of the same order is always fine
  const known = await getCreation(id);
  if (known && known.guestId !== guest.id) return false;
  if (!known) {
    if ((await countOrders(guest.id, event.slug)) >= event.maxOrdersPerGuest) return false;
    if (!(await claimCreation(id, guest.id, event.slug))) return event.free; // a resend raced us
    const url = (v: unknown) => (okUrl(v) ? v : null);
    after(async () => {
      try {
        const creation = await fillCreation(id, {
          photoUrl: url(order.photoUrl),
          stickerUrl: url(order.stickerUrl),
          stickers: items.map((it) => it.url),
          sheets: Array.isArray(order.sheetUrls) ? order.sheetUrls.filter(okUrl) : [],
        });
        if (guestEmailReady()) {
          const r = await sendGuestEmail(guest, creation);
          if (r.sent) await markEmailed(id);
          else console.error("[booth/kit] guest email failed:", r.error);
        }
      } catch (e) {
        console.error("[booth/kit] saving the guest's creation failed:", e);
      }
    });
  }
  return event.free;
}

async function queueOrder(order: OrderIn, kitUrl: string, guides: string[], items: QueueItem[]) {
  const id = String(order?.id ?? "");
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) return false;
  const checkoutId = typeof order.checkoutId === "string" && order.checkoutId.startsWith("cs_") ? order.checkoutId : null;
  const sheets = parseSheets(order.sheets);
  if (!sheets.length) return false;
  const productId = sheets.join("+");
  const freeEventOrder = order.event ? await eventOrder(order, id, items).catch((e) => (console.error("[booth/kit] event order:", e), false)) : false;
  // no card payment: only a prepaid (free) event lets it print
  const verified = checkoutId ? await checkoutPaid(checkoutId, productId) : freeEventOrder || (await isFreeEvent());
  try {
    await enqueue({ id, boothId: process.env.BOOTH_ID || "booth-1", productId, checkoutId, verified, kitUrl, guideUrl: guides[0] ?? null, guides, items });
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
    const { guide, guides: guideList, items, order } = await request.json();
    if (!Array.isArray(items) || !items.length || items.length > 48) return NextResponse.json({ error: "Bad kit" }, { status: 400 });
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : undefined);
    const clean: QueueItem[] = items.map((it: Record<string, unknown>, i: number) => {
      if (!okUrl(it.url)) throw new Error("Bad image URL");
      const item: QueueItem = { n: Number(it.n) || i + 1, url: it.url, w: num(it.w) ?? 0, h: num(it.h) ?? 0 };
      if (it.sheet !== undefined) item.sheet = Math.max(0, Math.min(2, Number(it.sheet) || 0));
      if (it.x !== undefined) item.x = num(it.x);
      if (it.y !== undefined) item.y = num(it.y);
      return item;
    });
    const guides = (Array.isArray(guideList) ? guideList : [guide]).filter(okUrl).slice(0, 3);
    const guideUrl = guides[0] ?? null;
    const manifest = await uploadJson({ kind: "mesticker-liene-kit", created: Date.now(), guide: guideUrl, guides, items: clean });
    // a localhost NEXT_PUBLIC_APP_URL (set for dev) must not leak into preview/prod kit links
    const envOrigin = process.env.NEXT_PUBLIC_APP_URL;
    const origin = envOrigin && !envOrigin.includes("localhost") ? envOrigin.replace(/\/$/, "") : request.nextUrl.origin;
    const url = `${origin}/booth/kit?m=${encodeURIComponent(manifest)}`;
    const queued = order ? await queueOrder(order, url, guides, clean) : false;
    return NextResponse.json({ url, queued });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kit failed" }, { status: 400 });
  }
}
