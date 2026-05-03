export interface StylePreset {
  id: string;
  name: string;
  description: string;
  previewImage: string;
  prompt: string;
}

export interface Creation {
  id: string;
  createdAt: string;
  originalImage: string;
  generatedImage: string;
  stylePreset: string;
  ordered: boolean;
  sessionId?: string;
}

export interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  stateCode: string;
  countryCode: string;
  zip: string;
}

export interface Order {
  id: string;
  createdAt: string;
  imageUrl: string;
  originalImageUrl: string;
  stylePreset: string;
  quantity: number;
  shippingAddress: ShippingAddress;
  stripePaymentIntentId: string;
  printfulOrderId?: string;
  status:
    | "pending_payment"
    | "paid"
    | "submitted_to_printful"
    | "in_production"
    | "shipped"
    | "delivered";
  totalAmount: number;
}

export type AppStep = "capture" | "style" | "reveal" | "variations" | "order";

export interface CartItem {
  id: string;
  generatedImage: string;  // composed sheet image
  originalImage: string;
  stylePreset: string;
  skuId: string;
  productType: "sticker-pack" | "variation-sheet";
  tierId?: string;  // for sticker packs: "pack-10" | "pack-25" | "pack-50"
  sheets: number;   // actual number of Printful sheets to fulfill
}
