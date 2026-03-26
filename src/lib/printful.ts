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

// Product 358 = Kiss-Cut Stickers (individual, kiss-cut around design shape).
// Each sticker has a transparent-background image and Printful cuts around the
// non-transparent area — this is the correct product for our use case.
//
// Product 505 (Sticker Sheet) requires a full sheet layout and does NOT
// individually kiss-cut each sticker from a single image file.
const KISS_CUT_PRODUCT_ID = 358;

// Default stickers per order ("pack of 6")
export const STICKERS_PER_PACK = 6;

// Auto-discover the 3"×3" variant ID from the Printful catalog.
// Cached after first call so we only hit the API once per server lifetime.
let cachedVariantId: number | null = null;

async function getKissCutVariantId(): Promise<number> {
  // Env override — skip auto-discovery if explicitly set
  if (process.env.PRINTFUL_VARIANT_ID) {
    return parseInt(process.env.PRINTFUL_VARIANT_ID);
  }

  if (cachedVariantId !== null) return cachedVariantId;

  try {
    const res = await fetch(`${PRINTFUL_API}/products/${KISS_CUT_PRODUCT_ID}`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      console.warn(`Failed to fetch kiss-cut sticker variants: ${res.status}`);
      // Fallback: commonly-referenced 3"×3" variant for Product 358
      return 10164;
    }

    const data = await res.json();
    const variants: { id: number; name: string; size: string }[] =
      data?.result?.variants || [];

    // Prefer 3"×3" — good balance of size, visibility, and cost
    const preferred = variants.find(
      (v) =>
        v.size?.includes("3×3") ||
        v.size?.includes("3x3") ||
        v.size?.includes('3"') ||
        v.name?.toLowerCase().includes("3×3") ||
        v.name?.toLowerCase().includes("3x3") ||
        v.name?.toLowerCase().includes('3"')
    );

    const chosen = preferred || variants[0];
    if (chosen) {
      cachedVariantId = chosen.id;
      console.log(
        `Printful kiss-cut sticker: using variant ${chosen.id} (${chosen.name || chosen.size})`
      );
      return cachedVariantId;
    }

    console.warn("No kiss-cut sticker variants found — using fallback 10164");
    return 10164;
  } catch (err) {
    console.warn("Failed to auto-discover kiss-cut variant:", err);
    return 10164;
  }
}

export interface PrintfulOrderItem {
  imageUrl: string;
  quantity: number;
}

export async function createPrintfulOrder(
  items: PrintfulOrderItem[],
  address: ShippingAddress
) {
  const variantId = await getKissCutVariantId();

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
