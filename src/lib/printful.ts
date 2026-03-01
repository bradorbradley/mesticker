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

// Kiss-cut sticker SHEET product/variant IDs from Printful catalog
// Product 505 = Kiss-cut sticker sheet, variant 12917 = 5.83"×8.27" (fits 6 stickers)
const STICKER_VARIANT_ID = 12917;

export async function createPrintfulOrder(
  imageUrl: string,
  quantity: number,
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
      items: [
        {
          variant_id: STICKER_VARIANT_ID,
          quantity,
          files: [
            {
              type: "default",
              url: imageUrl,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Printful API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.result;
}
