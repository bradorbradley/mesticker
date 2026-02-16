import { NextRequest, NextResponse } from "next/server";
import { getStripe, STICKERS_PER_SHEET } from "@/lib/stripe";
import { createPrintfulOrder, PrintfulOrderItem } from "@/lib/printful";
import { getDb } from "@/lib/db";

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

      // Parse multi-item order from metadata
      const itemCount = parseInt(meta?.itemCount || "0");
      const items: PrintfulOrderItem[] = [];
      let totalSheets = 0;

      for (let i = 0; i < itemCount; i++) {
        const imageUrl = meta[`item_${i}_imageUrl`];
        const sheets = parseInt(meta[`item_${i}_sheets`] || "0");
        if (imageUrl && sheets > 0) {
          items.push({ imageUrl, sheets });
          totalSheets += sheets;
        }
      }

      const address = {
        name: meta.addressName,
        address1: meta.address1,
        address2: meta.address2 || undefined,
        city: meta.city,
        stateCode: meta.stateCode,
        countryCode: meta.countryCode,
        zip: meta.zip,
      };

      // Save order to database if user was signed in
      if (meta?.userId && process.env.DATABASE_URL) {
        try {
          const sql = getDb();
          const firstImageUrl = items[0]?.imageUrl || "";
          await sql`
            INSERT INTO orders (
              user_id, stripe_payment_intent_id, quantity, amount_cents, image_url,
              shipping_name, shipping_address1, shipping_address2,
              shipping_city, shipping_state, shipping_country, shipping_zip,
              status
            ) VALUES (
              ${meta.userId}, ${paymentIntent.id},
              ${totalSheets * STICKERS_PER_SHEET},
              ${paymentIntent.amount}, ${firstImageUrl},
              ${address.name}, ${address.address1}, ${address.address2 || null},
              ${address.city}, ${address.stateCode}, ${address.countryCode}, ${meta.zip},
              'paid'
            )
          `;
        } catch (dbError) {
          console.error("Failed to save order to DB:", dbError);
        }
      }

      // Submit to Printful
      if (items.length > 0) {
        await createPrintfulOrder(items, address);
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
