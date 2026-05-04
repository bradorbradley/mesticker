import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createPrintfulOrder } from "@/lib/printful";
import { getDb } from "@/lib/db";
import { generatePrint } from "@/lib/generation";
import { composeSheet } from "@/lib/sheet-composer";
import { uploadImage } from "@/lib/storage";

interface CartBlobItem {
  composedImageUrl: string;
  sourceCartoonUrl?: string;
  prompts: string[];
  quantity: number;
  tierId: string;
  sheetVariant: "pack" | "stack" | "original";
}

interface CartBlob {
  items: CartBlobItem[];
}

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function fetchAsBuffer(dataUrl: string): Promise<Buffer> {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64, "base64");
}

/**
 * For a single cart item: regen each prompt at quality:high, recompose the
 * sheet server-side via sharp, upload, return the HQ sheet URL. Falls back
 * to the original composedImageUrl if anything goes wrong (graceful — the
 * user already paid, we still want to ship something).
 */
async function regenerateHQ(item: CartBlobItem): Promise<string> {
  if (!item.sourceCartoonUrl || item.prompts.length === 0) {
    return item.composedImageUrl;
  }

  try {
    const cartoonDataUrl = await fetchAsBase64(item.sourceCartoonUrl);

    const tilesHQ = await Promise.all(
      item.prompts.map((prompt) => generatePrint(cartoonDataUrl, prompt))
    );

    const buffers = await Promise.all(tilesHQ.map(fetchAsBuffer));
    // Single-design sheets repeat 1 image to fill 6 cells; pack sheets use
    // the actual variations. Match the client-side composer's logic.
    const composeBuffers =
      item.sheetVariant === "stack" && buffers.length === 1
        ? Array(6).fill(buffers[0])
        : buffers.slice(0, 6);

    const { buffer: composedBuf } = await composeSheet(composeBuffers);
    const dataUrl = `data:image/png;base64,${composedBuf.toString("base64")}`;
    return await uploadImage(dataUrl);
  } catch (err) {
    console.error("[hq-regen] failed for item, falling back:", err);
    return item.composedImageUrl;
  }
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
  }

  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    let event;
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const meta = paymentIntent.metadata;

      if (!meta?.addressName) {
        console.warn(
          `[webhook] PaymentIntent ${paymentIntent.id} succeeded without addressName.`
        );
      }

      // Save order row immediately (before HQ regen + Printful submission)
      if (meta?.userId && process.env.DATABASE_URL) {
        try {
          const sql = getDb();
          const qty = meta.totalQty || "1";
          await sql`
            INSERT INTO orders (
              user_id, stripe_payment_intent_id, quantity, amount_cents, image_url,
              shipping_name, shipping_address1, shipping_address2,
              shipping_city, shipping_state, shipping_country, shipping_zip,
              status
            ) VALUES (
              ${meta.userId}, ${paymentIntent.id}, ${parseInt(qty)},
              ${paymentIntent.amount}, ${meta.cartUrl || ""},
              ${meta.addressName}, ${meta.address1}, ${meta.address2 || null},
              ${meta.city}, ${meta.stateCode}, ${meta.countryCode}, ${meta.zip},
              'paid'
            )
          `;
        } catch (dbError) {
          console.error("Failed to save order to DB:", dbError);
        }
      }

      const address = {
        name: meta.addressName,
        address1: meta.address1,
        address2: meta.address2 || undefined,
        city: meta.city,
        stateCode: meta.stateCode,
        countryCode: meta.countryCode,
        zip: meta.zip,
      };

      // Background work: HQ regen + Printful submission. Runs after the
      // webhook responds 200 so Stripe doesn't time out. If anything fails,
      // each item gracefully falls back to its low-res preview sheet.
      if (meta?.cartUrl) {
        const cartUrl = meta.cartUrl;
        after(async () => {
          try {
            const cartRes = await fetch(cartUrl);
            if (!cartRes.ok) {
              throw new Error(`Failed to fetch cart blob: ${cartRes.status}`);
            }
            const cart = (await cartRes.json()) as CartBlob;

            // Run HQ regen for every item in parallel. Each item's regen
            // fans out to N parallel high-quality image gens for its prompts.
            const finalItems = await Promise.all(
              cart.items.map(async (item) => ({
                imageUrl: await regenerateHQ(item),
                quantity: item.quantity,
              }))
            );

            await createPrintfulOrder(finalItems, address);
          } catch (err) {
            console.error("[webhook:after] HQ regen / Printful submission failed:", err);
          }
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 400 }
    );
  }
}
