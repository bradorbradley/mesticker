import { NextRequest, NextResponse } from "next/server"

// Debug endpoint - check Printful orders and product info
// Access at /api/debug/printful

export async function GET(request: NextRequest) {
  const apiKey = process.env.PRINTFUL_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "No Printful API key configured" }, { status: 500 })
  }

  try {
    // Get recent orders
    const ordersRes = await fetch("https://api.printful.com/orders?limit=10", {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const ordersData = await ordersRes.json()

    // Get product 358 (Kiss-Cut Stickers) to see variants
    const productRes = await fetch("https://api.printful.com/products/358", {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const productData = await productRes.json()

    // Check variant 10163 specifically
    const variantRes = await fetch("https://api.printful.com/products/variant/10163", {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const variantData = await variantRes.json()

    return NextResponse.json({
      current_variant_id: 10163,
      variant_info: variantData,
      sticker_product_358: productData,
      recent_orders: ordersData,
      orders_count: ordersData.result?.length || 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
