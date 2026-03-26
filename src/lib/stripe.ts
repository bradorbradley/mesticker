import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// Sticker pack pricing — each pack = 6 individual 3"×3" kiss-cut stickers
//
// Cost breakdown per pack (Printful product 358, kiss-cut 3"×3"):
//   Printful (~$2.50 ea × 6):  ~$15.00
//   Shipping (flat):           ~$3.99
//   Stripe fees:               ~2.9% + $0.30
//
//   1 pack:  $15.99 → thin margin but customer-acquisition price
//   2 packs: $28.99 → better margin at scale
export const STICKERS_PER_PACK = 6;
export const PACK_PRICE_CENTS = 1599; // $15.99 per pack of 6

export function calculatePackTotal(totalPacks: number) {
  if (totalPacks < 1) throw new Error("Must order at least 1 pack");
  const total = totalPacks * PACK_PRICE_CENTS;
  return { total, pricePerPack: PACK_PRICE_CENTS, totalPacks };
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
