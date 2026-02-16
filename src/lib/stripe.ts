import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// Pack pricing (in cents) — shipping is included in price ("free shipping")
//
// Cost breakdown per pack (conservative: $3/sticker + $5 Printful shipping):
//   3-pack: Printful ~$14.00 + Stripe ~$0.88 = ~$14.88 → sell $19.99 → profit ~$5.11
//   5-pack: Printful ~$20.00 + Stripe ~$1.17 = ~$21.17 → sell $29.99 → profit ~$8.82
//  10-pack: Printful ~$35.00 + Stripe ~$1.75 = ~$36.75 → sell $49.99 → profit ~$13.24
export const PACK_OPTIONS = [
  { quantity: 3,  totalCents: 1999, label: "3 Pack"  },  // $19.99 ($6.66/ea)
  { quantity: 5,  totalCents: 2999, label: "5 Pack"  },  // $29.99 ($6.00/ea) — most popular
  { quantity: 10, totalCents: 4999, label: "10 Pack" },  // $49.99 ($5.00/ea) — best value
] as const;

export function calculateTotal(quantity: number) {
  const pack = PACK_OPTIONS.find((p) => p.quantity === quantity);
  if (!pack) throw new Error(`Invalid pack quantity: ${quantity}`);
  const pricePerSticker = Math.round(pack.totalCents / pack.quantity);
  return { subtotal: pack.totalCents, shipping: 0, total: pack.totalCents, pricePerSticker };
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
