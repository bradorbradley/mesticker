import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// Sticker sheet pricing — each A4 sheet has 6 kiss-cut 3"x3" stickers
//
// Cost breakdown per sheet (Printful sticker sheet product 505, A4):
//   Printful sheet:  ~$10.00
//   Shipping (1st):  ~$3.99  (additional sheets ~$1.45 ea)
//   Stripe fees:     ~2.9% + $0.30
//
//   1 sheet:  $15.99 → COGS ~$14.50 → profit ~$1.50 (acquisition price)
//   2 sheets: $31.98 → COGS ~$26.00 → profit ~$6.00
//   3 sheets: $47.97 → COGS ~$37.50 → profit ~$10.50
export const STICKERS_PER_SHEET = 6;
export const SHEET_PRICE_CENTS = 1599; // $15.99 per sheet

export function calculateSheetTotal(totalSheets: number) {
  if (totalSheets < 1) throw new Error("Must order at least 1 sheet");
  const total = totalSheets * SHEET_PRICE_CENTS;
  return { total, pricePerSheet: SHEET_PRICE_CENTS, totalSheets };
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
