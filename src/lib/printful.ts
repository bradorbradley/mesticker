import { ShippingAddress } from "@/types";

const PRINTFUL_API = "https://api.printful.com";

function getHeaders() {
  const token = process.env.PRINTFUL_ACCESS_TOKEN;
  if (!token) throw new Error("PRINTFUL_ACCESS_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-PF-Store-Id": process.env.PRINTFUL_STORE_ID || "",
  };
}

// ── Product config ──────────────────────────────────────────────────────
//
// Product 505 = Kiss-Cut Sticker Sheet.
// A sheet with multiple individually kiss-cut stickers — the buyer peels
// each one off.  This is our default: one sheet = one "pack".
//
// Product 358 = Kiss-Cut Stickers (individual).
// A single sticker in various sizes (2"×2" → 5.5"×5.5").
// NOT what we want for packs — each order line produces one loose sticker.
//
// PRINTFUL_PRODUCT_ID env override lets you switch without a deploy.
// PRINTFUL_VARIANT_ID env override pins a specific variant.

const DEFAULT_PRODUCT_ID = 505; // sticker sheet
export const STICKERS_PER_PACK = 6;

function getProductId(): number {
  if (process.env.PRINTFUL_PRODUCT_ID) {
    return parseInt(process.env.PRINTFUL_PRODUCT_ID);
  }
  return DEFAULT_PRODUCT_ID;
}

let cachedVariantId: number | null = null;

async function getVariantId(): Promise<number> {
  if (process.env.PRINTFUL_VARIANT_ID) {
    return parseInt(process.env.PRINTFUL_VARIANT_ID);
  }

  if (cachedVariantId !== null) return cachedVariantId;

  const productId = getProductId();

  try {
    const res = await fetch(`${PRINTFUL_API}/products/${productId}`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      console.warn(`Failed to fetch product ${productId} variants: ${res.status}`);
      return getFallbackVariant(productId);
    }

    const data = await res.json();
    const variants: { id: number; name: string; size: string }[] =
      data?.result?.variants || [];

    if (variants.length === 0) {
      console.warn(`No variants found for product ${productId}`);
      return getFallbackVariant(productId);
    }

    // For sticker sheets (505): prefer 4"×6" — good size for 6 small stickers
    // For individual stickers (358): prefer 3"×3"
    const preferred = productId === 505
      ? variants.find(
          (v) =>
            v.size?.includes("4×6") ||
            v.size?.includes("4x6") ||
            v.size?.includes('4"') ||
            v.name?.toLowerCase().includes("4×6") ||
            v.name?.toLowerCase().includes("4x6")
        )
      : variants.find(
          (v) =>
            v.size?.includes("3×3") ||
            v.size?.includes("3x3") ||
            v.size?.includes('3"') ||
            v.name?.toLowerCase().includes("3×3") ||
            v.name?.toLowerCase().includes("3x3") ||
            v.name?.toLowerCase().includes('3"')
        );

    const chosen = preferred || variants[0];
    cachedVariantId = chosen.id;
    console.log(
      `Printful product ${productId}: using variant ${chosen.id} (${chosen.name || chosen.size})`
    );
    return cachedVariantId;
  } catch (err) {
    console.warn("Failed to auto-discover variant:", err);
    return getFallbackVariant(productId);
  }
}

function getFallbackVariant(productId: number): number {
  // These are best-guess fallback IDs — run scripts/printful-catalog.ts to
  // discover the real ones for your store.
  if (productId === 505) {
    console.warn("Using fallback variant for sticker sheet (product 505)");
    return 14048; // commonly-referenced 4"×6" sticker sheet variant
  }
  console.warn("Using fallback variant for kiss-cut sticker (product 358)");
  return 10164; // commonly-referenced 3"×3" individual sticker variant
}

export interface PrintfulOrderItem {
  imageUrl: string;
  quantity: number;
}

export async function createPrintfulOrder(
  items: PrintfulOrderItem[],
  address: ShippingAddress
) {
  const variantId = await getVariantId();

  const printfulItems = items.map((item) => ({
    variant_id: variantId,
    quantity: item.quantity,
    files: [{ type: "default" as const, url: item.imageUrl }],
  }));

  const response = await fetch(`${PRINTFUL_API}/orders?confirm=true`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      recipient: {
        name: address.name,
        address1: address.address1,
        address2: address.address2 || undefined,
        city: address.city,
        state_code: address.stateCode,
        country_code: address.countryCode,
        zip: address.zip,
      },
      items: printfulItems,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Printful API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.result;
}
