import { NextRequest, NextResponse } from "next/server";
import {
  createPaymentIntent,
  updatePaymentIntentMetadata,
  updatePaymentIntentAmount,
} from "@/lib/stripe";
import { uploadImage, uploadJson } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { getSessionIdFromCookie } from "@/lib/session";
import { ShippingAddress } from "@/types";
import { getTier, getShipping } from "@/lib/pricing";

interface CartItemInput {
  generatedImage: string;             // low-res composed sheet (preview / fallback)
  stylePreset: string;
  sheetVariant: "pack" | "stack" | "original";
  tierId: string;
  sourceCartoon?: string;             // base64 of the original cartoon (for HQ regen)
  prompts?: string[];                 // variation prompts; empty = no regen
}

/**
 * Cart payload schema we drop into Vercel Blob, referenced by cartUrl in the
 * Stripe PaymentIntent metadata. Lets us carry richer per-item data than
 * the 500-char-per-value Stripe metadata limit allows.
 */
interface CartBlobItem {
  composedImageUrl: string;           // low-res sheet (Printful fallback)
  sourceCartoonUrl?: string;          // for HQ regen
  prompts: string[];
  quantity: number;
  tierId: string;
  sheetVariant: "pack" | "stack" | "original";
}

async function buildCartBlob(items: CartItemInput[]): Promise<{
  cartUrl: string;
  totalQty: number;
  itemCount: number;
}> {
  const blobItems: CartBlobItem[] = await Promise.all(
    items.map(async (item) => {
      const composedImageUrl = await uploadImage(item.generatedImage);
      const sourceCartoonUrl = item.sourceCartoon
        ? await uploadImage(item.sourceCartoon)
        : undefined;
      const tier = getTier(item.tierId);
      return {
        composedImageUrl,
        sourceCartoonUrl,
        prompts: item.prompts || [],
        quantity: tier.qty,
        tierId: item.tierId,
        sheetVariant: item.sheetVariant,
      };
    })
  );

  const cartUrl = await uploadJson({ items: blobItems });
  const totalQty = blobItems.reduce((s, i) => s + i.quantity, 0);
  return { cartUrl, totalQty, itemCount: blobItems.length };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const sessionId = getSessionIdFromCookie(request.headers.get("cookie"));

    const {
      email,
      items,
      address,
      totalCents,
    }: {
      email?: string;
      items: CartItemInput[];
      address?: ShippingAddress;
      totalCents?: number;
    } = await request.json();

    if (!items?.length) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    const { cartUrl, totalQty, itemCount } = await buildCartBlob(items);

    let subtotalCents: number;
    if (typeof totalCents === "number" && totalCents > 0) {
      subtotalCents = totalCents;
    } else {
      subtotalCents = items.reduce(
        (sum, i) => sum + getTier(i.tierId).priceCents,
        0
      );
    }
    const shippingCents = getShipping();
    const total = subtotalCents + shippingCents;

    const metadata: Record<string, string> = {
      cartUrl,
      totalQty: String(totalQty),
      itemCount: String(itemCount),
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
      totalCents,
      items,
    }: {
      paymentIntentId: string;
      email?: string;
      address?: ShippingAddress;
      totalCents?: number;
      items?: CartItemInput[];
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

    if (items && items.length > 0) {
      const { cartUrl, totalQty, itemCount } = await buildCartBlob(items);
      metadata.cartUrl = cartUrl;
      metadata.totalQty = String(totalQty);
      metadata.itemCount = String(itemCount);
    }

    if (typeof totalCents === "number" && totalCents > 0) {
      await updatePaymentIntentAmount(
        paymentIntentId,
        totalCents,
        Object.keys(metadata).length ? metadata : undefined
      );
    } else if (Object.keys(metadata).length) {
      await updatePaymentIntentMetadata(paymentIntentId, metadata);
    }

    return NextResponse.json({ updated: true, amount: totalCents });
  } catch (error) {
    console.error("Order PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
