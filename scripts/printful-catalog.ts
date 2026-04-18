#!/usr/bin/env npx tsx
/**
 * Run: PRINTFUL_ACCESS_TOKEN=your_token npx tsx scripts/printful-catalog.ts
 *
 * Queries the Printful catalog API and prints ALL sticker-related products
 * and their variants (sizes, prices, variant IDs).
 */

const TOKEN = process.env.PRINTFUL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("Set PRINTFUL_ACCESS_TOKEN env var");
  process.exit(1);
}

const STICKER_PRODUCT_IDS = [
  { id: 358, name: "Kiss-Cut Stickers (individual)" },
  { id: 505, name: "Kiss-Cut Sticker Sheet" },
  { id: 668, name: "Kiss-Cut Holographic Stickers" },
];

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function fetchProduct(productId: number) {
  const res = await fetch(`https://api.printful.com/products/${productId}`, { headers });
  if (!res.ok) {
    console.error(`  ❌ Failed to fetch product ${productId}: ${res.status}`);
    return null;
  }
  return res.json();
}

async function main() {
  console.log("=== Printful Sticker Product Catalog ===\n");

  for (const product of STICKER_PRODUCT_IDS) {
    console.log(`\n📦 Product ${product.id}: ${product.name}`);
    console.log("─".repeat(60));

    const data = await fetchProduct(product.id);
    if (!data?.result) continue;

    const { product: productInfo, variants } = data.result;
    console.log(`  Description: ${productInfo?.description?.slice(0, 120) || "N/A"}`);
    console.log(`  Type: ${productInfo?.type || "N/A"}`);
    console.log(`  Variants: ${variants?.length || 0}\n`);

    if (variants) {
      console.log("  ID      | Size            | Name                                  | Price");
      console.log("  " + "─".repeat(80));
      for (const v of variants) {
        const price = v.price ? `$${v.price}` : "N/A";
        console.log(
          `  ${String(v.id).padEnd(7)} | ${(v.size || "").padEnd(15)} | ${(v.name || "").padEnd(37)} | ${price}`
        );
      }
    }
  }

  // Also list ALL products in the sticker category if available
  console.log("\n\n=== Full Sticker Category Search ===\n");
  try {
    const res = await fetch("https://api.printful.com/products", { headers });
    if (res.ok) {
      const data = await res.json();
      const stickerProducts = (data.result || []).filter(
        (p: { type_name?: string; title?: string }) =>
          p.type_name?.toLowerCase().includes("sticker") ||
          p.title?.toLowerCase().includes("sticker")
      );
      console.log(`Found ${stickerProducts.length} sticker-related products:\n`);
      for (const p of stickerProducts) {
        console.log(`  ID ${p.id}: ${p.title} (${p.type_name || "N/A"})`);
      }
    }
  } catch (err) {
    console.error("Failed to fetch full product list:", err);
  }
}

main().catch(console.error);
