import { NextRequest, NextResponse } from "next/server";
import { getOrder } from "@/lib/booth-queue";
import { getCreation } from "@/lib/guests";

/**
 * GET ?id=<order uuid> → { sheet, stickers } for the "get your stickers" QR (/s/<id>): the guest's
 * phone shows them with one Save button. Order ids are random UUIDs shown only on the guest's screen.
 * Event orders return the saved clean sheet; others the stickers off the print queue.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  try {
    const [c, o] = await Promise.all([getCreation(id).catch(() => null), getOrder(id)]);
    if (!c && !o) return NextResponse.json({ ready: false }, { status: 404, headers: { "Cache-Control": "no-store" } });
    // the sticker art without the print-only pieces (logo + handle pill are the first/last slots of event sheets)
    const fromQueue = o ? Array.from(new Set(o.items.filter((it) => !it.brand).map((it) => it.url))) : [];
    const stickers = c?.ready && c.stickers.length ? c.stickers : fromQueue;
    const sheet = (c?.ready && c.sheets[0]) || null;
    return NextResponse.json({ ready: stickers.length > 0, sheet, stickers, hero: (c?.ready && c.stickerUrl) || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[booth/order-files]", e);
    return NextResponse.json({ error: "Unavailable" }, { status: 500 });
  }
}
