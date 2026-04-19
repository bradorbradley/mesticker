import { NextResponse } from "next/server"
import { listStickerSheetVariants, listSingleStickerVariants, STICKER_VARIANT_ID } from "@/lib/printful"

// Debug endpoint: hit this in your browser (local or prod) to find variant IDs
// GET /api/debug/printful
//
// Returns Product 505 (Kiss-Cut Sticker Sheet) and Product 358 (single Kiss-Cut stickers)
// so you can pick the correct variant_id and set PRINTFUL_STICKER_VARIANT_ID in env.

export async function GET() {
  const apiKey = process.env.PRINTFUL_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "No Printful API key configured" }, { status: 500 })
  }

  try {
    const [sheets, singles, ordersRes] = await Promise.all([
      listStickerSheetVariants(),
      listSingleStickerVariants(),
      fetch("https://api.printful.com/orders?limit=10", {
        headers: { Authorization: `Bearer ${apiKey}` },
      }).then(r => r.json()),
    ])

    // Simplify the variant lists so they're scannable
    const simplifyVariants = (productData: any) => {
      const variants = productData?.result?.variants || []
      return variants.map((v: any) => ({
        variant_id: v.id,
        name: v.name,
        size: v.size,
        price: v.price,
      }))
    }

    return NextResponse.json({
      current_variant_id_in_code: STICKER_VARIANT_ID,
      instructions: "Set PRINTFUL_STICKER_VARIANT_ID env var to the variant_id you want to sell. Recommended: use a Product 505 Sticker Sheet variant.",
      kiss_cut_sticker_sheets_product_505: {
        product: productData_meta(sheets),
        variants: simplifyVariants(sheets),
      },
      single_kiss_cut_stickers_product_358: {
        product: productData_meta(singles),
        variants: simplifyVariants(singles),
      },
      recent_orders: {
        count: ordersRes?.result?.length || 0,
        orders: (ordersRes?.result || []).map((o: any) => ({
          id: o.id,
          status: o.status,
          recipient: o.recipient?.name,
          created: new Date(o.created * 1000).toISOString(),
          items: o.items?.map((i: any) => ({ variant_id: i.variant_id, name: i.name, quantity: i.quantity })),
        })),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function productData_meta(data: any) {
  const p = data?.result?.product
  if (!p) return null
  return {
    id: p.id,
    title: p.title,
    type_name: p.type_name,
    description_short: (p.description || "").slice(0, 200),
  }
}
