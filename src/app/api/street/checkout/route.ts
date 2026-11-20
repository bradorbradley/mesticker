import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { BOOTH_FREE_MODE, STICKERS_PER_SHEET, bundlePrice } from "@/lib/booth-config";
import { getOrder, setCheckout, setPayment, validId } from "@/lib/street-orders";

/**
 * Street mode payment: POST { id } → a Stripe Checkout Session for one
 * Pose Party sheet, paid on the guest's own phone (Apple Pay / Google Pay /
 * card). Returns { url } to send the guest to, or { free: true } when Stripe
 * isn't set up (or free mode is on), in which case the order goes straight
 * to the seller marked as free.
 */

function appOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json().catch(() => ({}));
    if (!validId(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    const order = await getOrder(id);
    if (!order?.mainUrl) return NextResponse.json({ error: "Make your sticker first" }, { status: 400 });
    if (order.payment !== "none") return NextResponse.json({ already: order.payment });

    if (!process.env.STRIPE_SECRET_KEY || BOOTH_FREE_MODE) {
      await setPayment(id, "free");
      return NextResponse.json({ free: true });
    }

    // same origin as the page the guest is on, so they come back to it
    const origin = appOrigin(request);
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: bundlePrice(1),
            product_data: {
              name: "MeSticker · Pose Party sticker sheet",
              description: `${STICKERS_PER_SHEET} chibi stickers of you, printed on the spot · order ${order.code}`,
            },
          },
        },
      ],
      metadata: { source: "street", streetOrder: id, code: order.code, sheets: "pose" },
      payment_intent_data: { metadata: { source: "street", streetOrder: id } },
      success_url: `${origin}/street/done?o=${id}`,
      cancel_url: `${origin}/street?o=${id}`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60, // Stripe minimum is 30 min
    });
    await setCheckout(id, session.id);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[street/checkout] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 500 });
  }
}
