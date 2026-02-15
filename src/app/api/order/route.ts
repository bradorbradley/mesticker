import { NextRequest, NextResponse } from "next/server";
import { createPaymentIntent, calculateTotal } from "@/lib/stripe";
import { uploadImage } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { ShippingAddress } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const {
      image,
      quantity,
      address,
    }: {
      image: string;
      quantity: number;
      address: ShippingAddress;
    } = await request.json();

    if (!image || !quantity || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upload image to get a public URL (needed for Printful later)
    const imageUrl = await uploadImage(image);

    // Calculate total and create Stripe payment intent
    const { total } = calculateTotal(quantity);
    const paymentIntent = await createPaymentIntent(total, {
      imageUrl,
      quantity: String(quantity),
      addressName: address.name,
      address1: address.address1,
      address2: address.address2 || "",
      city: address.city,
      stateCode: address.stateCode,
      countryCode: address.countryCode,
      zip: address.zip,
      // Include user ID in metadata so the webhook can link the order
      ...(session?.user?.id ? { userId: session.user.id } : {}),
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: total,
      imageUrl,
    });
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order creation failed" },
      { status: 500 }
    );
  }
}
