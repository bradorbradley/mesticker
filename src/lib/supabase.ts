import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ""

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export interface Order {
  id: string
  created_at: string
  email: string
  image_url: string
  style_preset: string
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  printful_order_id: number | null
  status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "failed"
  shipping_name: string | null
  shipping_address: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  shipping_country: string | null
  tracking_number: string | null
  tracking_url: string | null
}

export interface Generation {
  id: string
  created_at: string
  style_preset: string
  image_url: string | null
  converted_to_order: boolean
}

// Order functions
export async function createOrder(
  order: Omit<Order, "id" | "created_at">
): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single()

  if (error) {
    console.error("Error creating order:", error)
    return null
  }

  return data
}

export async function updateOrder(
  id: string,
  updates: Partial<Order>
): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating order:", error)
    return null
  }

  return data
}

export async function getOrderByStripeSession(
  sessionId: string
): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select()
    .eq("stripe_checkout_session_id", sessionId)
    .single()

  if (error) {
    console.error("Error fetching order:", error)
    return null
  }

  return data
}

export async function getOrderById(id: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select()
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error fetching order:", error)
    return null
  }

  return data
}

// Generation tracking functions
export async function trackGeneration(
  stylePreset: string,
  imageUrl: string | null = null
): Promise<Generation | null> {
  const { data, error } = await supabase
    .from("generations")
    .insert({
      style_preset: stylePreset,
      image_url: imageUrl,
      converted_to_order: false,
    })
    .select()
    .single()

  if (error) {
    console.error("Error tracking generation:", error)
    return null
  }

  return data
}

export async function markGenerationConverted(id: string): Promise<void> {
  await supabase
    .from("generations")
    .update({ converted_to_order: true })
    .eq("id", id)
}
