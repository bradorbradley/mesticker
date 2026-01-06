import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Printful webhook event types
type PrintfulWebhookType =
  | "package_shipped"
  | "package_returned"
  | "order_created"
  | "order_updated"
  | "order_failed"
  | "order_canceled"

interface PrintfulWebhookPayload {
  type: PrintfulWebhookType
  created: number
  retries: number
  store: number
  data: {
    order: {
      id: number
      external_id: string
      status: string
      shipping: string
      created: number
      updated: number
      shipments?: {
        id: number
        carrier: string
        service: string
        tracking_number: string
        tracking_url: string
        created: number
        ship_date: string
        shipped_at: number
        reshipment: boolean
        items: {
          item_id: number
          quantity: number
        }[]
      }[]
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload: PrintfulWebhookPayload = await request.json()

    console.log("Printful webhook received:", payload.type)

    const orderId = payload.data.order.id

    switch (payload.type) {
      case "package_shipped": {
        const shipment = payload.data.order.shipments?.[0]

        if (shipment) {
          console.log(`Order ${orderId} shipped:`, {
            trackingNumber: shipment.tracking_number,
            trackingUrl: shipment.tracking_url,
            carrier: shipment.carrier,
          })

          // Update order in database
          try {
            const { error } = await supabase
              .from("orders")
              .update({
                status: "shipped",
                tracking_number: shipment.tracking_number,
                tracking_url: shipment.tracking_url,
              })
              .eq("printful_order_id", orderId)

            if (error) {
              console.error("Failed to update order:", error)
            }
          } catch (e) {
            console.log("Database update skipped:", e)
          }
        }
        break
      }

      case "order_failed": {
        console.error(`Order ${orderId} failed`)

        try {
          await supabase
            .from("orders")
            .update({ status: "failed" })
            .eq("printful_order_id", orderId)
        } catch (e) {
          console.log("Database update skipped:", e)
        }
        break
      }

      case "order_canceled": {
        console.log(`Order ${orderId} canceled`)

        try {
          await supabase
            .from("orders")
            .update({ status: "failed" })
            .eq("printful_order_id", orderId)
        } catch (e) {
          console.log("Database update skipped:", e)
        }
        break
      }

      case "package_returned": {
        console.log(`Order ${orderId} returned`)
        break
      }

      default:
        console.log(`Unhandled Printful event: ${payload.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("Printful webhook error:", error)
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    )
  }
}
