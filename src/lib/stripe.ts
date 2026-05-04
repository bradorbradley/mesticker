import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// Pack pricing (in cents)
// Printful kiss-cut sticker cost: ~$2.50/sticker + ~$4.50 shipping
// We mark up ~50-80% on cost to cover fees + profit
export const PACK_OPTIONS = [
  { quantity: 3, pricePerSticker: 499, label: "3 Pack" },   // $4.99/ea = $14.97 total
  { quantity: 5, pricePerSticker: 349, label: "5 Pack" },   // $3.49/ea = $17.45 total (most popular)
  { quantity: 10, pricePerSticker: 249, label: "10 Pack" },  // $2.49/ea = $24.90 total (best value)
] as const;

const SHIPPING_CENTS = 499; // $4.99 flat shipping

export function calculateTotal(quantity: number) {
  const pack = PACK_OPTIONS.find((p) => p.quantity === quantity);
  if (!pack) throw new Error(`Invalid pack quantity: ${quantity}`);
  const subtotal = pack.pricePerSticker * pack.quantity;
  const shipping = SHIPPING_CENTS;
  const total = subtotal + shipping;
  return { subtotal, shipping, total, pricePerSticker: pack.pricePerSticker };
}

export async function createPaymentIntent(amountCents: number, metadata: Record<string, string>) {
  const stripe = getStripe();
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    metadata,
    automatic_payment_methods: { enabled: true },
  });
}

export async function updatePaymentIntentMetadata(id: string, metadata: Record<string, string>) {
  const stripe = getStripe();
  return stripe.paymentIntents.update(id, { metadata });
}

export async function updatePaymentIntentAmount(
  id: string,
  amountCents: number,
  metadata?: Record<string, string>
) {
  const stripe = getStripe();
  const update: { amount: number; metadata?: Record<string, string> } = { amount: amountCents };
  if (metadata) update.metadata = metadata;
  return stripe.paymentIntents.update(id, update);
}
