import { getStripe } from "@/lib/stripe";

/**
 * Is this booth Checkout Session paid, for exactly these sheets? Checked with
 * Stripe on the server, never taken from the browser.
 */
export async function checkoutPaid(checkoutId: string, productId: string): Promise<boolean> {
  if (!process.env.STRIPE_SECRET_KEY || !checkoutId.startsWith("cs_")) return false;
  try {
    const session = await getStripe().checkout.sessions.retrieve(checkoutId);
    // paid, from the booth, and for exactly these sheets (not 1 paid, 3 printed)
    return session.payment_status === "paid" && session.metadata?.source === "booth" && session.metadata?.sheets === productId;
  } catch (e) {
    console.error("[booth] Stripe check failed:", e);
    return false;
  }
}
