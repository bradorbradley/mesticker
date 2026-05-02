import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createPrintfulOrder } from "@/lib/printful";
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

      // Save order to database
      if (meta?.userId && process.env.DATABASE_URL) {
        try {
          const sql = getDb();
          const qty = meta.totalSheets || meta.quantity || "1";
          let imageUrl = meta.imageUrl || "";
          if (!imageUrl && meta.cartItems) {
            try {
              const items = JSON.parse(meta.cartItems);
              imageUrl = items[0]?.imageUrl || "";
            } catch {}
          }
          await sql`
            INSERT INTO orders (
              user_id, stripe_payment_intent_id, quantity, amount_cents, image_url,
              shipping_name, shipping_address1, shipping_address2,
              shipping_city, shipping_state, shipping_country, shipping_zip,
              status
            ) VALUES (
              ${meta.userId}, ${paymentIntent.id}, ${parseInt(qty)},
              ${paymentIntent.amount}, ${imageUrl},
              ${meta.addressName}, ${meta.address1}, ${meta.address2 || null},
              ${meta.city}, ${meta.stateCode}, ${meta.countryCode}, ${meta.zip},
              'paid'
            )
          `;
        } catch (dbError) {
          console.error("Failed to save order to DB:", dbError);
        }
      }

      // Submit to Printful
      const address = {
        name: meta.addressName,
        address1: meta.address1,
        address2: meta.address2 || undefined,
        city: meta.city,
        stateCode: meta.stateCode,
        countryCode: meta.countryCode,
        zip: meta.zip,
      };

      if (meta?.cartItems) {
        const cartItems = JSON.parse(meta.cartItems) as {
          imageUrl: string;
          quantity: number;
          skuId?: string;
        }[];
        // createPrintfulOrder handles variant selection based on skuId
        await createPrintfulOrder(
          cartItems.map((item) => ({
            imageUrl: item.imageUrl,
            quantity: item.quantity,
            skuId: item.skuId,
          })),
          address
        );
      } else if (meta?.imageUrl && meta?.quantity) {
        await createPrintfulOrder(
          [{ imageUrl: meta.imageUrl, quantity: parseInt(meta.quantity) }],
          address
        );
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
