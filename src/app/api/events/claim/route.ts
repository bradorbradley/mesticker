import { NextRequest, NextResponse, after } from "next/server";
import { deliverCreation } from "@/lib/guest-email";
import { attachGuest, countOrders, getCreation, guestByIdToken } from "@/lib/guests";
import { getPartyEvent } from "@/lib/party-events";

/**
 * A guest who scanned the booth's QR (and signed up on their phone) claims the order they just made.
 *   POST { orderId, guestId, token } → { ok, ready }   then their stickers are emailed.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const guest = await guestByIdToken(body.guestId, body.token);
  if (!guest) return NextResponse.json({ error: "Please sign up again" }, { status: 401 });
  if (typeof body.orderId !== "string" || !/^[a-zA-Z0-9-]{8,64}$/.test(body.orderId)) return NextResponse.json({ error: "Bad order" }, { status: 400 });
  const c = await getCreation(body.orderId);
  if (!c) return NextResponse.json({ error: "Order not found yet" }, { status: 404 });
  const event = getPartyEvent(c.event);
  if (event && c.guestId !== guest.id && (await countOrders(guest.id, event.slug)) >= event.maxOrdersPerGuest + 2) {
    return NextResponse.json({ error: "That's a lot of stickers! Ask the host." }, { status: 429 });
  }
  const mine = await attachGuest(body.orderId, guest.id);
  if (!mine) return NextResponse.json({ error: "These stickers belong to someone else" }, { status: 409 });
  after(() => deliverCreation(body.orderId).catch((e) => console.error("[events/claim] deliver:", e)));
  return NextResponse.json({ ok: true, ready: mine.ready });
}
