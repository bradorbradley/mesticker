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

const STICKER_SHEET_PRODUCT_ID = 505;
const INDIVIDUAL_STICKER_VARIANT_ID = 10163; // Product 358, 3"x3" kiss-cut
const STICKERS_PER_SHEET = 6;

// Auto-discover the sticker sheet variant ID from the Printful catalog.
// Cached after first call so we only hit the API once per server lifetime.
let cachedSheetVariantId: number | null = null;

async function getSheetVariantId(): Promise<number | null> {
  // Env override — skip auto-discovery if explicitly set
  if (process.env.PRINTFUL_SHEET_VARIANT_ID) {
    return parseInt(process.env.PRINTFUL_SHEET_VARIANT_ID);
  }

  if (cachedSheetVariantId !== null) return cachedSheetVariantId;

  try {
    const res = await fetch(`${PRINTFUL_API}/products/${STICKER_SHEET_PRODUCT_ID}`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      console.warn(`Failed to fetch sticker sheet variants: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const variants: { id: number; name: string; size: string }[] =
      data?.result?.variants || [];

    // Prefer 4"×6" (smallest/cheapest sheet) — good for a 2×2 grid of 3" stickers.
    // If not found, take the first available variant.
    const preferred = variants.find(
      (v) =>
        v.size?.includes("4×6") ||
        v.size?.includes("4x6") ||
        v.name?.toLowerCase().includes("4×6") ||
        v.name?.toLowerCase().includes("4x6") ||
        v.name?.toLowerCase().includes('4"')
    );

    const chosen = preferred || variants[0];
    if (chosen) {
      cachedSheetVariantId = chosen.id;
      console.log(
        `Printful sticker sheet: using variant ${chosen.id} (${chosen.name || chosen.size})`
      );
      return cachedSheetVariantId;
    }

    console.warn("No sticker sheet variants found in Printful catalog");
    return null;
  } catch (err) {
    console.warn("Failed to auto-discover sticker sheet variant:", err);
    return null;
  }
}

export interface PrintfulOrderItem {
  imageUrl: string;
  sheets: number;
}

export async function createPrintfulOrder(
  items: PrintfulOrderItem[],
  address: ShippingAddress
) {
  const sheetVariantId = await getSheetVariantId();

  const printfulItems = items.map((item) => {
    if (sheetVariantId) {
      return {
        variant_id: sheetVariantId,
        quantity: item.sheets,
        files: [{ type: "default" as const, url: item.imageUrl }],
      };
    }
    // Fallback: individual stickers if sheet product unavailable
    return {
      variant_id: INDIVIDUAL_STICKER_VARIANT_ID,
      quantity: item.sheets * STICKERS_PER_SHEET,
      files: [{ type: "default" as const, url: item.imageUrl }],
    };
  });

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
