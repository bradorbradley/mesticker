import { NextRequest, NextResponse } from "next/server";
import { createPaymentIntent, calculatePackTotal } from "@/lib/stripe";
import { uploadImage } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { ShippingAddress } from "@/types";
import { STICKERS_PER_PACK } from "@/lib/printful";

interface OrderItem {
  imageUrl?: string;
  generatedImage?: string;
  packs: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const {
      items,
      address,
    }: {
      items: OrderItem[];
      address: ShippingAddress;
    } = await request.json();

    if (!items?.length || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Ensure every item has a public image URL — upload on-the-fly if missing
    const uploadedItems: { imageUrl: string; packs: number }[] = [];
    for (const item of items) {
      let url = item.imageUrl;
      if (!url && item.generatedImage) {
        url = await uploadImage(item.generatedImage);
      }
      if (!url) {
        return NextResponse.json(
          { error: "Missing image — please regenerate your sticker" },
          { status: 400 }
        );
      }
      uploadedItems.push({ imageUrl: url, packs: item.packs });
    }

    // Calculate total
    const totalPacks = items.reduce((sum, i) => sum + i.packs, 0);
    const { total } = calculatePackTotal(totalPacks);

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
      metadata[`item_${i}_packs`] = String(uploadedItems[i].packs);
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
