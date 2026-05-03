import { NextRequest, NextResponse } from "next/server";
import { createPaymentIntent, updatePaymentIntentMetadata } from "@/lib/stripe";
import { uploadImage } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { getSessionIdFromCookie } from "@/lib/session";
import { ShippingAddress } from "@/types";
import {
  STICKER_PACK_TIERS,
  VARIATION_SHEET_PRICE_CENTS,
  SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
} from "@/lib/pricing";

interface CartItemInput {
  generatedImage: string;
  sheets: number;
  stylePreset: string;
  skuId?: string;
  productType?: "sticker-pack" | "variation-sheet";
  tierId?: string;
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
      email?: string;
      items: CartItemInput[];
      address?: ShippingAddress;
    } = await request.json();

    if (!items?.length) {
      return NextResponse.json(
        { error: "At least one item is required" },
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
          productType: item.productType || "sticker-pack",
          tierId: item.tierId,
        };
      })
    );

    // Calculate total with new pricing model
    let subtotalCents = 0;
    for (const item of items) {
      if (item.productType === "variation-sheet") {
        subtotalCents += VARIATION_SHEET_PRICE_CENTS;
      } else {
        // sticker-pack
        const tier = STICKER_PACK_TIERS.find((t) => t.id === item.tierId);
        subtotalCents += tier ? tier.priceCents : STICKER_PACK_TIERS[0].priceCents;
      }
    }
    const shippingCents =
      subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
    const total = subtotalCents + shippingCents;

    const totalSheets = items.reduce((sum, i) => sum + i.sheets, 0);

    // Build metadata — address and email are optional now
    const metadata: Record<string, string> = {
      totalSheets: String(totalSheets),
      itemCount: String(items.length),
      cartItems: JSON.stringify(
        uploadedItems.map((i) => ({
          imageUrl: i.imageUrl,
          quantity: i.sheets,
          skuId: i.skuId,
          productType: i.productType,
          tierId: i.tierId,
        }))
      ),
      ...(session?.user?.id ? { userId: session.user.id } : {}),
      ...(sessionId ? { sessionId } : {}),
    };

    if (email) {
      metadata.email = email;
    }

    if (address) {
      metadata.addressName = address.name;
      metadata.address1 = address.address1;
      metadata.address2 = address.address2 || "";
      metadata.city = address.city;
      metadata.stateCode = address.stateCode;
      metadata.countryCode = address.countryCode;
      metadata.zip = address.zip;
    }

    const paymentIntent = await createPaymentIntent(total, metadata);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
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

// PATCH — update PaymentIntent metadata (address/email before confirming)
export async function PATCH(request: NextRequest) {
  try {
    const {
      paymentIntentId,
      email,
      address,
    }: {
      paymentIntentId: string;
      email?: string;
      address?: ShippingAddress;
    } = await request.json();

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId is required" },
        { status: 400 }
      );
    }

    const metadata: Record<string, string> = {};
    if (email) {
      metadata.email = email;
    }
    if (address) {
      metadata.addressName = address.name;
      metadata.address1 = address.address1;
      metadata.address2 = address.address2 || "";
      metadata.city = address.city;
      metadata.stateCode = address.stateCode;
      metadata.countryCode = address.countryCode;
      metadata.zip = address.zip;
    }

    await updatePaymentIntentMetadata(paymentIntentId, metadata);

    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Order PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
