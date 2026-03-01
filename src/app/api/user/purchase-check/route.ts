import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

/**
 * Check if an email has any successful purchases.
 * This works for ALL users — logged in or not.
 * Used to unlock unlimited generations for paying customers.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ hasPurchased: false });
    }

    const stripe = getStripe();

    // Search Stripe for successful payments with this email
    const paymentIntents = await stripe.paymentIntents.search({
      query: `status:"succeeded" AND metadata["email"]:"${email}"`,
      limit: 1,
    });

    if (paymentIntents.data.length > 0) {
      return NextResponse.json({ hasPurchased: true });
    }

    // Also check by Stripe customer email
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (customers.data.length > 0) {
      const charges = await stripe.charges.list({
        customer: customers.data[0].id,
        limit: 1,
      });
      if (charges.data.some((c) => c.paid)) {
        return NextResponse.json({ hasPurchased: true });
      }
    }

    return NextResponse.json({ hasPurchased: false });
  } catch (error) {
    console.error("Purchase check error:", error);
    return NextResponse.json({ hasPurchased: false });
  }
}
