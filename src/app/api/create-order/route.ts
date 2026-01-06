import { NextRequest, NextResponse } from "next/server"
import { retrievePaymentIntent } from "@/lib/stripe"
import { createPrintfulOrder } from "@/lib/printful"
import { createOrder, updateOrder, getOrderByStripeSession } from "@/lib/supabase"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, imageUrl, shipping, email } = body

    // Verify the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "shipping_details"],
    })

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      )
    }

    // Get shipping details from Stripe
    const shippingDetails = session.shipping_details
    if (!shippingDetails?.address) {
      return NextResponse.json(
        { error: "Shipping address not provided" },
        { status: 400 }
      )
    }

    const shippingAddress = {
      name: shippingDetails.name || "",
      address: shippingDetails.address.line1 || "",
      city: shippingDetails.address.city || "",
      state: shippingDetails.address.state || "",
      zip: shippingDetails.address.postal_code || "",
      country: shippingDetails.address.country || "US",
    }

    // Get image URL from session metadata
    const stickerImageUrl = session.metadata?.imageUrl || imageUrl

    if (!stickerImageUrl) {
      return NextResponse.json(
        { error: "No sticker image URL found" },
        { status: 400 }
      )
    }

    // Create Printful order
    const printfulOrder = await createPrintfulOrder(stickerImageUrl, shippingAddress)

    // Update order in database
    try {
      const existingOrder = await getOrderByStripeSession(sessionId)
      if (existingOrder) {
        await updateOrder(existingOrder.id, {
          status: "processing",
          printful_order_id: printfulOrder.result.id,
          shipping_name: shippingAddress.name,
          shipping_address: shippingAddress.address,
          shipping_city: shippingAddress.city,
          shipping_state: shippingAddress.state,
          shipping_zip: shippingAddress.zip,
          shipping_country: shippingAddress.country,
        })
      }
    } catch (e) {
      console.log("Supabase update skipped:", e)
    }

    return NextResponse.json({
      orderId: printfulOrder.result.id,
      printfulOrderId: printfulOrder.result.id,
      status: printfulOrder.result.status,
      estimatedDelivery: "5-7 business days",
    })
  } catch (error: any) {
    console.error("Order creation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create order" },
      { status: 500 }
    )
  }
}
