import { NextRequest, NextResponse } from "next/server";
import { createPaymentIntent } from "@/lib/stripe";
import { uploadImage } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { getSessionIdFromCookie } from "@/lib/session";
import { ShippingAddress } from "@/types";

// Pricing (cents) — keep in sync with order-form.tsx
const SHEET_PRICES_CENTS: Record<number, number> = {
  1: 1999,
  2: 3499,
  3: 4999,
};
const PER_SHEET_FALLBACK_CENTS = 1599;
const HOLOGRAPHIC_UPGRADE_CENTS = 500;
const SHIPPING_CENTS = 499;
const FREE_SHIPPING_THRESHOLD = 3500;

interface CartItemInput {
  generatedImage: string;
  sheets: number;
  stylePreset: string;
  skuId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const sessionId = getSessionIdFromCookie(request.headers.get("cookie"));

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
          skuId: item.skuId || "kiss-cut-sheet",
        };
      })
    );

    // Calculate total with new pricing
    let subtotalCents = 0;
    for (const item of items) {
      const base = SHEET_PRICES_CENTS[item.sheets] ?? item.sheets * PER_SHEET_FALLBACK_CENTS;
      const holo = item.skuId === "holographic-sheet" ? HOLOGRAPHIC_UPGRADE_CENTS * item.sheets : 0;
      subtotalCents += base + holo;
    }
    const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CENTS;
    const total = subtotalCents + shippingCents;

    const totalSheets = items.reduce((sum, i) => sum + i.sheets, 0);

    const paymentIntent = await createPaymentIntent(total, {
      email,
      totalSheets: String(totalSheets),
      itemCount: String(items.length),
      cartItems: JSON.stringify(
        uploadedItems.map((i) => ({
          imageUrl: i.imageUrl,
          quantity: i.sheets,
          skuId: i.skuId,
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
      ...(sessionId ? { sessionId } : {}),
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
