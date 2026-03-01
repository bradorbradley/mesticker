import { NextRequest, NextResponse } from "next/server";
import { createPaymentIntent } from "@/lib/stripe";
import { uploadImage } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { ShippingAddress } from "@/types";

// Pricing constants — keep in sync with cart.tsx and order-form.tsx
const PRICE_PER_SHEET_CENTS = 1499; // $14.99
const SHIPPING_CENTS = 499; // $4.99

interface CartItemInput {
  generatedImage: string;
  sheets: number;
  stylePreset: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const {
      email,
      items,
      address,
    }: {
      email: string;
      items: CartItemInput[];
      address: ShippingAddress;
    } = await request.json();

    if (!email || !items?.length || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upload all images and build metadata
    const uploadedItems = await Promise.all(
      items.map(async (item) => {
        const imageUrl = await uploadImage(item.generatedImage);
        return {
          imageUrl,
          sheets: item.sheets,
          stylePreset: item.stylePreset,
        };
      })
    );

    // Calculate total
    const totalSheets = items.reduce((sum, i) => sum + i.sheets, 0);
    const total = totalSheets * PRICE_PER_SHEET_CENTS + SHIPPING_CENTS;

    const paymentIntent = await createPaymentIntent(total, {
      email,
      totalSheets: String(totalSheets),
      itemCount: String(items.length),
      // Store image URLs as JSON for webhook to submit to Printful
      cartItems: JSON.stringify(
        uploadedItems.map((i) => ({
          imageUrl: i.imageUrl,
          quantity: i.sheets,
        }))
      ),
      addressName: address.name,
      address1: address.address1,
      address2: address.address2 || "",
      city: address.city,
      stateCode: address.stateCode,
      countryCode: address.countryCode,
      zip: address.zip,
      ...(session?.user?.id ? { userId: session.user.id } : {}),
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: total,
    });
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order creation failed" },
      { status: 500 }
    );
  }
}
