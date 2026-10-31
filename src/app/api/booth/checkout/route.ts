import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { DEFAULT_PRODUCT_ID, getProduct } from "@/lib/booth-config";

/**
 * QR-code payment for the booth.
 *
 *   POST → creates a Stripe Checkout Session; the booth shows its URL as a QR
 *          code, the guest pays on their own phone (Apple Pay / Google Pay / card).
 *   GET ?id=cs_… → { paid } — the booth polls this until the guest has paid.
 *
 * No webhook needed: the booth only cares whether this one session is paid.
 */

function appOrigin(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ free: true });
  }
  try {
    const { styleId, productId } = await request.json().catch(() => ({ styleId: "", productId: "" }));
    // Price always comes from the server-side menu, never from the client.
    const product = getProduct(productId) ?? getProduct(DEFAULT_PRODUCT_ID)!;
    const origin = appOrigin(request);
    const boothId = process.env.BOOTH_ID || "booth-1";
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: product.priceCents,
            product_data: {
              name: `MeSticker ${product.name}`,
              description: `${product.blurb}, printed right now at the booth`,
            },
          },
        },
      ],
      metadata: { source: "booth", boothId, styleId: String(styleId || ""), productId: product.id },
      payment_intent_data: { metadata: { source: "booth", boothId } },
      success_url: `${origin}/booth/paid`,
      cancel_url: `${origin}/booth/paid?canceled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60, // Stripe minimum is 30 min
    });
    return NextResponse.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error("[booth/checkout] create failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id?.startsWith("cs_")) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }
  try {
    const session = await getStripe().checkout.sessions.retrieve(id);
    return NextResponse.json({
      paid: session.payment_status === "paid",
      status: session.status, // open | complete | expired
      paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lookup failed" },
      { status: 500 }
    );
  }
}
