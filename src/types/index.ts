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
  imageUrl?: string;
  stylePreset: string;
  ordered: boolean;
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

export interface CartItem {
  creationId: string;
  imageUrl?: string;
  generatedImage?: string;
  stylePreset: string;
  sheets: number;
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

export type AppStep = "capture" | "style" | "order";
