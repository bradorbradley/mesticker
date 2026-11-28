import { NextRequest, NextResponse } from "next/server";
import { stationAuthorized } from "@/lib/booth-queue";
import { listGuests } from "@/lib/guests";

/** Event guests for the admin (station key). ?format=csv downloads a spreadsheet. */
export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: NextRequest) {
  if (!stationAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const guests = await listGuests();
  if (request.nextUrl.searchParams.get("format") === "csv") {
    const head = ["email", "name", "signed_up", "events", "orders", "media_release", "marketing_ok", "unsubscribed", "gallery_token"];
    const rows = guests.map((g) => [g.email, g.name, g.createdAt, g.events.join(" "), g.orders, g.mediaConsent ? "yes" : "no", g.marketingConsent && !g.unsubscribedAt ? "yes" : "no", g.unsubscribedAt ?? "", g.token]);
    const csv = [head, ...rows].map((r) => r.map(cell).join(",")).join("\n");
    return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="mesticker-guests-${new Date().toISOString().slice(0, 10)}.csv"` } });
  }
  return NextResponse.json({
    total: guests.length,
    media: guests.filter((g) => g.mediaConsent).length,
    marketing: guests.filter((g) => g.marketingConsent && !g.unsubscribedAt).length,
    guests: guests.slice(0, 200).map((g) => ({ email: g.email, name: g.name, createdAt: g.createdAt, orders: g.orders, media: g.mediaConsent, marketing: g.marketingConsent && !g.unsubscribedAt })),
  });
}
