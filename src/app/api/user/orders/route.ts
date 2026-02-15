import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

// GET /api/user/orders — list the current user's orders
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sql = getDb();
  const rows = await sql`
    SELECT
      id, creation_id, stripe_payment_intent_id, printful_order_id,
      quantity, amount_cents, image_url, status,
      shipping_name, shipping_address1, shipping_address2,
      shipping_city, shipping_state, shipping_country, shipping_zip,
      created_at
    FROM orders
    WHERE user_id = ${session.user.id}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const orders = rows.map((r) => ({
    id: r.id,
    creationId: r.creation_id,
    quantity: r.quantity,
    amount: r.amount_cents,
    imageUrl: r.image_url,
    status: r.status,
    shippingAddress: {
      name: r.shipping_name,
      address1: r.shipping_address1,
      address2: r.shipping_address2,
      city: r.shipping_city,
      stateCode: r.shipping_state,
      countryCode: r.shipping_country,
      zip: r.shipping_zip,
    },
    printfulOrderId: r.printful_order_id,
    createdAt: r.created_at,
  }));

  return NextResponse.json(orders);
}
