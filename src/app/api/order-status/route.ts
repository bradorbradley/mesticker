import { NextRequest, NextResponse } from "next/server"
import { getOrderByStripeSession } from "@/lib/supabase"

/**
 * Read-only endpoint to fetch an order's status on the confirmation page.
 * The order itself is created by the Stripe webhook (single source of truth).
 *
 * GET /api/order-status?session_id=cs_...
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")

  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 })
  }

  try {
    const order = await getOrderByStripeSession(sessionId)

    if (!order) {
      // Webhook may not have fired yet. Return pending so the UI waits.
      return NextResponse.json({ status: "pending", printful_order_id: null })
    }

    return NextResponse.json({
      status: order.status,
      printful_order_id: order.printful_order_id,
      tracking_number: order.tracking_number,
      tracking_url: order.tracking_url,
    })
  } catch (error: any) {
    return NextResponse.json(
      { status: "pending", error: error.message },
      { status: 200 }
    )
  }
}
