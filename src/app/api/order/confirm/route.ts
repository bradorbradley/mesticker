import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createPrintfulOrder, PrintfulOrderItem, STICKERS_PER_PACK } from "@/lib/printful";
import { getDb } from "@/lib/db";
import { ShippingAddress } from "@/types";

/**
 * Fulfills an order: parses payment intent metadata, saves to DB, creates Printful order.
 * Address can come from PI metadata (card flow) or from the request body (express checkout).
 */
async function fulfillOrder(
  paymentIntent: {
    id: string;
    amount: number;
    status: string;
    metadata: Record<string, string>;
  },
  addressOverride?: ShippingAddress
) {
  if (paymentIntent.status !== "succeeded") {
    throw new Error(`Payment not succeeded (status: ${paymentIntent.status})`);
  }

  const meta = paymentIntent.metadata;

  // Parse multi-item order from metadata
  const itemCount = parseInt(meta?.itemCount || "0");
  const items: PrintfulOrderItem[] = [];
  let totalStickers = 0;

  for (let i = 0; i < itemCount; i++) {
    const imageUrl = meta[`item_${i}_imageUrl`];
    const packs = parseInt(meta[`item_${i}_packs`] || meta[`item_${i}_sheets`] || "0");
    if (imageUrl && packs > 0) {
      const quantity = packs * STICKERS_PER_PACK;
      items.push({ imageUrl, quantity });
      totalStickers += quantity;
    }
  }

  // Address: prefer override (from express checkout), fall back to PI metadata
  const address = addressOverride || {
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
          ${totalStickers},
          ${paymentIntent.amount}, ${firstImageUrl},
          ${address.name}, ${address.address1}, ${address.address2 || null},
          ${address.city}, ${address.stateCode}, ${address.countryCode}, ${address.zip},
          'paid'
        )
        ON CONFLICT (stripe_payment_intent_id) DO NOTHING
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

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    // Path 1: Stripe webhook with signature verification
    if (sig && webhookSecret) {
      const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      if (event.type === "payment_intent.succeeded") {
        await fulfillOrder(event.data.object as unknown as {
          id: string; amount: number; status: string; metadata: Record<string, string>;
        });
      }
      return NextResponse.json({ received: true });
    }

    // Path 2: Direct client call with paymentIntentId
    const data = JSON.parse(body);

    if (data.paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(data.paymentIntentId);

      // Express checkout sends address in the request body
      const addressOverride: ShippingAddress | undefined = data.shippingAddress
        ? {
            name: data.shippingAddress.name || "",
            address1: data.shippingAddress.address1 || "",
            address2: data.shippingAddress.address2 || "",
            city: data.shippingAddress.city || "",
            stateCode: data.shippingAddress.stateCode || "",
            countryCode: data.shippingAddress.countryCode || "",
            zip: data.shippingAddress.zip || "",
          }
        : undefined;

      await fulfillOrder(
        paymentIntent as unknown as {
          id: string; amount: number; status: string; metadata: Record<string, string>;
        },
        addressOverride
      );
      return NextResponse.json({ received: true });
    }

    // Path 3: Webhook without signature verification (dev/no secret configured)
    if (data.type === "payment_intent.succeeded") {
      await fulfillOrder(data.data.object);
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Order confirm error:", error);
    return NextResponse.json(
      { error: "Order confirmation failed" },
      { status: 400 }
    );
  }
}
