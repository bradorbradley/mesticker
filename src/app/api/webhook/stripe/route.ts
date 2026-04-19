import { NextRequest, NextResponse } from "next/server"
import { constructWebhookEvent } from "@/lib/stripe"
import { createPrintfulOrder } from "@/lib/printful"
import { getOrderByStripeSession, updateOrder } from "@/lib/supabase"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
})

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "No signature provided" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await constructWebhookEvent(body, signature)
  } catch (err: any) {
    console.error("[stripe-webhook] signature verification failed:", err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      console.log("[stripe-webhook] checkout.session.completed:", session.id)

      const fullSession = await stripe.checkout.sessions.retrieve(session.id)

      const shippingDetails = fullSession.shipping_details
      const customerDetails = fullSession.customer_details
      const imageUrl = fullSession.metadata?.imageUrl

      if (!imageUrl) {
        console.error("[stripe-webhook] No image URL in session metadata")
        break
      }
      if (!shippingDetails?.address) {
        console.error("[stripe-webhook] No shipping address collected")
        break
      }

      // Idempotency: skip if we already created a Printful order for this session.
      let existingOrder = null
      try {
        existingOrder = await getOrderByStripeSession(session.id)
      } catch (e) {
        console.log("[stripe-webhook] order lookup skipped:", e)
      }

      if (existingOrder?.printful_order_id) {
        console.log(
          `[stripe-webhook] Printful order already exists (${existingOrder.printful_order_id}) — skipping duplicate creation`
        )
        break
      }

      try {
        const printfulOrder = await createPrintfulOrder(imageUrl, {
          name: shippingDetails.name || customerDetails?.name || "Customer",
          address: shippingDetails.address.line1 || "",
          city: shippingDetails.address.city || "",
          state: shippingDetails.address.state || "",
          zip: shippingDetails.address.postal_code || "",
          country: shippingDetails.address.country || "US",
        })

        console.log(`[stripe-webhook] Printful order created: ${printfulOrder.result.id}`)

        if (existingOrder) {
          try {
            await updateOrder(existingOrder.id, {
              status: "processing",
              printful_order_id: printfulOrder.result.id,
              stripe_payment_intent_id: session.payment_intent as string,
              shipping_name: shippingDetails.name,
              shipping_address: shippingDetails.address.line1,
              shipping_city: shippingDetails.address.city,
              shipping_state: shippingDetails.address.state,
              shipping_zip: shippingDetails.address.postal_code,
              shipping_country: shippingDetails.address.country,
            })
          } catch (e) {
            console.log("[stripe-webhook] db update skipped:", e)
          }
        }
      } catch (error) {
        console.error("[stripe-webhook] Failed to create Printful order:", error)
      }
      break
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      console.log("[stripe-webhook] payment_intent.succeeded:", paymentIntent.id)
      break
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      console.error("[stripe-webhook] payment_intent.payment_failed:", paymentIntent.id)
      break
    }

    default:
      console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
