import { NextRequest, NextResponse } from "next/server";
import { getEvent, setEvent } from "@/lib/booth-event";
import { stationAuthorized } from "@/lib/booth-queue";

/**
 * Event settings (see src/lib/booth-event.ts).
 *   GET  → { free }                       anyone (the booth and guest phones read it)
 *   POST { free: boolean } → { free }     station key only (/booth/admin)
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const e = await getEvent();
    return NextResponse.json({ free: e.free }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ free: false });
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.MCP_SECRET) return NextResponse.json({ error: "Set MCP_SECRET" }, { status: 503 });
  if (!stationAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.free !== "boolean") return NextResponse.json({ error: "Send { free: true | false }" }, { status: 400 });
  try {
    return NextResponse.json(await setEvent({ free: body.free }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save" }, { status: 500 });
  }
}
