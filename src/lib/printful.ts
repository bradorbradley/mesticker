import { ShippingAddress } from "@/types";
import { VARIANT_KISS_CUT_SHEET } from "@/lib/pricing";

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

export interface PrintfulItem {
  imageUrl: string;
  quantity: number;
}

export async function createPrintfulOrder(
  items: PrintfulItem[],
  address: ShippingAddress
) {
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
      items: items.map((item) => ({
        variant_id: VARIANT_KISS_CUT_SHEET,
        quantity: item.quantity,
        files: [{ type: "default", url: item.imageUrl }],
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Printful API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.result;
}
