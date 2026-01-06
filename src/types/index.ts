import { StylePresetKey } from "@/lib/constants"

export interface ShippingAddress {
  name: string
  address: string
  city: string
  state: string
  zip: string
  country: string
}

export interface Order {
  id: string
  created_at: string
  email: string
  image_url: string
  style_preset: StylePresetKey
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  printful_order_id: number | null
  status: OrderStatus
  shipping_name: string | null
  shipping_address: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  shipping_country: string | null
  tracking_number: string | null
  tracking_url: string | null
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "failed"

export interface Generation {
  id: string
  created_at: string
  style_preset: StylePresetKey
  image_url: string | null
  converted_to_order: boolean
}

export interface GenerateResponse {
  imageUrl: string
  generationId: string
  style: string
}

export interface CheckoutResponse {
  sessionId: string
  url: string
}

export interface OrderResponse {
  orderId: number
  printfulOrderId: number
  status: string
  estimatedDelivery: string
}
