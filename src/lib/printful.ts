const PRINTFUL_BASE_URL = "https://api.printful.com"

// Die-cut sticker variant ID - verify in Printful catalog
const STICKER_VARIANT_ID = 10163 // 3"x3" die-cut sticker

interface ShippingAddress {
  name: string
  address: string
  city: string
  state: string
  zip: string
  country: string
}

interface PrintfulOrderItem {
  variant_id: number
  quantity: number
  files: {
    type: string
    url: string
  }[]
}

interface PrintfulOrder {
  recipient: {
    name: string
    address1: string
    city: string
    state_code: string
    country_code: string
    zip: string
  }
  items: PrintfulOrderItem[]
}

interface PrintfulOrderResponse {
  code: number
  result: {
    id: number
    external_id: string
    status: string
    shipping: string
    created: number
    updated: number
    recipient: {
      name: string
      address1: string
      city: string
      state_code: string
      country_code: string
      zip: string
    }
    items: {
      id: number
      external_id: string
      variant_id: number
      quantity: number
    }[]
  }
}

export async function createPrintfulOrder(
  imageUrl: string,
  shipping: ShippingAddress
): Promise<PrintfulOrderResponse> {
  const orderData: PrintfulOrder = {
    recipient: {
      name: shipping.name,
      address1: shipping.address,
      city: shipping.city,
      state_code: shipping.state,
      country_code: shipping.country,
      zip: shipping.zip,
    },
    items: [
      {
        variant_id: STICKER_VARIANT_ID,
        quantity: 1,
        files: [
          {
            type: "default",
            url: imageUrl,
          },
        ],
      },
    ],
  }

  const response = await fetch(`${PRINTFUL_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderData),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Printful API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

export async function getPrintfulOrder(
  orderId: number
): Promise<PrintfulOrderResponse> {
  const response = await fetch(`${PRINTFUL_BASE_URL}/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch order: ${response.status}`)
  }

  return response.json()
}

export async function getShippingRates(
  shipping: ShippingAddress,
  imageUrl: string
): Promise<any> {
  const response = await fetch(`${PRINTFUL_BASE_URL}/shipping/rates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: {
        address1: shipping.address,
        city: shipping.city,
        state_code: shipping.state,
        country_code: shipping.country,
        zip: shipping.zip,
      },
      items: [
        {
          variant_id: STICKER_VARIANT_ID,
          quantity: 1,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get shipping rates: ${response.status}`)
  }

  return response.json()
}
