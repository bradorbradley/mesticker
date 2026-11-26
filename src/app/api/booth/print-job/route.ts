import { NextRequest, NextResponse } from "next/server";
import { getOrder, stationAuthorized } from "@/lib/booth-queue";
import { buildPrintJob, sheetCount } from "@/lib/print-job";

/**
 * Print data for one sheet of a queued order, for a device that prints by itself
 * (the admin page, over USB or Bluetooth). Auth: the station key, like the queue.
 *
 *   GET ?id=<order>&sheet=<0-based>&light=1 → { ok, issues, warnings, jpeg, plt, preview, sheets }
 *
 * `light=1` asks for a smaller image (Bluetooth). jpeg/plt are base64.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.MCP_SECRET) return NextResponse.json({ error: "Queue is off: set MCP_SECRET" }, { status: 503 });
  if (!stationAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const id = q.get("id");
  const sheet = Number(q.get("sheet") ?? 0);
  if (!id || !Number.isInteger(sheet) || sheet < 0 || sheet > 11) return NextResponse.json({ error: "Need id and sheet" }, { status: 400 });
  try {
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order" }, { status: 404 });
    const job = await buildPrintJob(order, sheet, q.get("light") === "1");
    return NextResponse.json({ ...job, sheets: sheetCount(order) });
  } catch (e) {
    console.error("[booth/print-job] failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't build the sheet" }, { status: 500 });
  }
}
