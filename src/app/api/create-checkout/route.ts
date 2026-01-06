import { NextRequest, NextResponse } from "next/server"
import { createCheckoutSession } from "@/lib/stripe"
import { createOrder } from "@/lib/supabase"
import { APP_CONFIG, PRICING } from "@/lib/constants"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageUrl, email, stylePreset } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image URL provided" },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Create Stripe checkout session
    const session = await createCheckoutSession(
      imageUrl,
      PRICING.totalPriceCents,
      `${APP_CONFIG.url}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      `${APP_CONFIG.url}/preview?imageUrl=${encodeURIComponent(imageUrl)}&style=${stylePreset}`,
      {
        imageUrl,
        email,
        stylePreset: stylePreset || "unknown",
      }
    )

    // Create pending order in database
    try {
      await createOrder({
        email,
        image_url: imageUrl,
        style_preset: stylePreset || "unknown",
        stripe_payment_intent_id: null,
        stripe_checkout_session_id: session.id,
        printful_order_id: null,
        status: "pending",
        shipping_name: null,
        shipping_address: null,
        shipping_city: null,
        shipping_state: null,
        shipping_zip: null,
        shipping_country: null,
        tracking_number: null,
        tracking_url: null,
      })
    } catch (e) {
      console.log("Supabase order creation skipped:", e)
    }

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error: any) {
    console.error("Checkout error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
