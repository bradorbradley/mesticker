import { NextRequest, NextResponse } from "next/server";
import { stationAuthorized } from "@/lib/booth-queue";
import { guestEmailReady, sendGuestEmail } from "@/lib/guest-email";
import { markEmailed, pendingEmails } from "@/lib/guests";

/**
 * Sticker emails that haven't gone out yet (email wasn't set up, or sending failed).
 *   GET  → { ready, pending }      POST → sends them, { sent, failed, errors }
 * Station key only.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!stationAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ready: guestEmailReady(), pending: (await pendingEmails(500)).length });
}

export async function POST(request: NextRequest) {
  if (!stationAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!guestEmailReady()) return NextResponse.json({ error: "Email isn't set up yet (RESEND_API_KEY + verified sender)" }, { status: 501 });
  let sent = 0;
  const errors: string[] = [];
  for (const { guest, creation } of await pendingEmails(40)) {
    const r = await sendGuestEmail(guest, creation).catch((e) => ({ sent: false, error: String(e) }));
    if (r.sent) {
      await markEmailed(creation.orderId);
      sent++;
    } else errors.push(`${guest.email}: ${r.error}`);
  }
  return NextResponse.json({ sent, failed: errors.length, errors: errors.slice(0, 5) });
}
