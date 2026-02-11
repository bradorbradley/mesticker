import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// Sticker pricing (in cents)
const STICKER_PRICE_CENTS = 999; // $9.99 per sticker
const SHIPPING_CENTS = 499; // $4.99 flat shipping

export function calculateTotal(quantity: number) {
  const subtotal = STICKER_PRICE_CENTS * quantity;
  const shipping = SHIPPING_CENTS;
  const total = subtotal + shipping;
  return { subtotal, shipping, total };
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
