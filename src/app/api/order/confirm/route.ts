import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createPrintfulOrder } from "@/lib/printful";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
  }

  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    let event;

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const meta = paymentIntent.metadata;

      if (meta?.imageUrl && meta?.quantity) {
        await createPrintfulOrder(meta.imageUrl, parseInt(meta.quantity), {
          name: meta.addressName,
          address1: meta.address1,
          address2: meta.address2 || undefined,
          city: meta.city,
          stateCode: meta.stateCode,
          countryCode: meta.countryCode,
          zip: meta.zip,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 400 }
    );
  }
}
