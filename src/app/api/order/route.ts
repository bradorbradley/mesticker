import { NextRequest, NextResponse } from "next/server";
import { createPaymentIntent, updatePaymentIntentMetadata } from "@/lib/stripe";
import { uploadImage } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { getSessionIdFromCookie } from "@/lib/session";
import { ShippingAddress } from "@/types";
import {
  getTier,
  getShipping,
  type ProductType,
} from "@/lib/pricing";

interface CartItemInput {
  generatedImage: string;
  stylePreset: string;
  productType: ProductType;
  tierId: string;
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

    const uploadedItems = await Promise.all(
      items.map(async (item) => {
        const imageUrl = await uploadImage(item.generatedImage);
        const tier = getTier(item.productType, item.tierId);
        return {
          imageUrl,
          stylePreset: item.stylePreset,
          productType: item.productType,
          tierId: item.tierId,
          quantity: tier.qty,
        };
      })
    );

    let subtotalCents = 0;
    for (const item of items) {
      subtotalCents += getTier(item.productType, item.tierId).priceCents;
    }
    const shippingCents = getShipping(subtotalCents);
    const total = subtotalCents + shippingCents;

    const totalQty = uploadedItems.reduce((sum, i) => sum + i.quantity, 0);

    const metadata: Record<string, string> = {
      totalQty: String(totalQty),
      itemCount: String(items.length),
      cartItems: JSON.stringify(
        uploadedItems.map((i) => ({
          imageUrl: i.imageUrl,
          quantity: i.quantity,
          productType: i.productType,
          tierId: i.tierId,
        }))
      ),
      ...(session?.user?.id ? { userId: session.user.id } : {}),
      ...(sessionId ? { sessionId } : {}),
    };

    if (email) metadata.email = email;
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
      subtotalCents,
      shippingCents,
    });
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order creation failed" },
      { status: 500 }
    );
  }
}

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
    if (email) metadata.email = email;
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
