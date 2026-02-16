import { NextRequest, NextResponse } from "next/server";
import { createPaymentIntent, calculateSheetTotal } from "@/lib/stripe";
import { auth } from "@/lib/auth";
import { ShippingAddress, CartItem } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const {
      items,
      address,
    }: {
      items: CartItem[];
      address: ShippingAddress;
    } = await request.json();

    if (!items?.length || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Images are pre-uploaded during generation — just use the URLs
    const uploadedItems: { imageUrl: string; sheets: number }[] = [];
    for (const item of items) {
      if (!item.imageUrl) {
        return NextResponse.json(
          { error: "Missing image URL — please regenerate your sticker" },
          { status: 400 }
        );
      }
      uploadedItems.push({ imageUrl: item.imageUrl, sheets: item.sheets });
    }

    // Calculate total
    const totalSheets = items.reduce((sum, i) => sum + i.sheets, 0);
    const { total } = calculateSheetTotal(totalSheets);

    // Encode items into Stripe metadata (keyed by index)
    const metadata: Record<string, string> = {
      itemCount: String(uploadedItems.length),
      addressName: address.name,
      address1: address.address1,
      address2: address.address2 || "",
      city: address.city,
      stateCode: address.stateCode,
      countryCode: address.countryCode,
      zip: address.zip,
      ...(session?.user?.id ? { userId: session.user.id } : {}),
    };

    for (let i = 0; i < uploadedItems.length; i++) {
      metadata[`item_${i}_imageUrl`] = uploadedItems[i].imageUrl;
      metadata[`item_${i}_sheets`] = String(uploadedItems[i].sheets);
    }

    const paymentIntent = await createPaymentIntent(total, metadata);

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
