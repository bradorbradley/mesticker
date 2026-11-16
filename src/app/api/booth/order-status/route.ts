import { NextRequest, NextResponse } from "next/server";
import { orderProgress } from "@/lib/booth-queue";

/**
 * GET ?id=<order uuid> → where a guest's order is: in line (and how many
 * ahead), being prepared, printing, done or failed. The booth polls this to
 * drive the progress bar while the guest plays a game. Public on purpose:
 * order ids are random UUIDs and this returns no images or personal data.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  try {
    const progress = await orderProgress(id);
    if (!progress) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(progress, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[booth/order-status]", e);
    return NextResponse.json({ error: "Status unavailable" }, { status: 500 });
  }
}
