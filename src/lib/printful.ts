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

// Kiss-Cut Sticker Sheet (product 505).
// To find the correct variant ID for your store, run:
//   curl -H "Authorization: Bearer $TOKEN" https://api.printful.com/products/505
// and look for the A4 variant. Set PRINTFUL_SHEET_VARIANT_ID in your env.
//
// Fallback: if not set, we order individual 3"x3" kiss-cut stickers (product 358,
// variant 10163) with quantity = stickers_per_sheet × sheets.
const STICKER_SHEET_VARIANT_ID = process.env.PRINTFUL_SHEET_VARIANT_ID
  ? parseInt(process.env.PRINTFUL_SHEET_VARIANT_ID)
  : null;

const INDIVIDUAL_STICKER_VARIANT_ID = 10163; // Product 358, 3"x3" kiss-cut
const STICKERS_PER_SHEET = 6;

export interface PrintfulOrderItem {
  imageUrl: string;
  sheets: number;
}

export async function createPrintfulOrder(
  items: PrintfulOrderItem[],
  address: ShippingAddress
) {
  const printfulItems = items.map((item) => {
    if (STICKER_SHEET_VARIANT_ID) {
      return {
        variant_id: STICKER_SHEET_VARIANT_ID,
        quantity: item.sheets,
        files: [{ type: "default" as const, url: item.imageUrl }],
      };
    }
    // Fallback: individual stickers
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
