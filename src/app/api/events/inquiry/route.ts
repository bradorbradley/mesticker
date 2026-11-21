import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { listInquiries, saveInquiry } from "@/lib/event-inquiries";

/**
 * Event booking requests from /events.
 *   POST { name, email, phone?, eventDate?, location?, guests?, hours?, eventType?, message?, website? }
 *        → saved, and emailed to EVENTS_NOTIFY_EMAIL when Resend is set up
 *   GET  ?key=<MCP_SECRET> → { inquiries } (newest first), for /events/inquiries
 */

const FROM = process.env.BOOTH_EMAIL_FROM || "MeSticker <stickers@mesticker.fun>";
const clip = (v: unknown, n: number) => {
  const s = String(v ?? "").trim().slice(0, n);
  return s || null;
};
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function staff(request: NextRequest) {
  const secret = process.env.MCP_SECRET || "";
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const a = Buffer.from(key), b = Buffer.from(secret);
  return !!secret && a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`event-inquiry:${getClientIP(request)}`, 8, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Try again in a bit, or email hello@mesticker.fun." }, { status: 429 });
  try {
    const body = await request.json();
    if (body.website) return NextResponse.json({ ok: true }); // honeypot: bots fill every field
    const name = clip(body.name, 120);
    const email = clip(body.email, 200);
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please add your name and a valid email." }, { status: 400 });
    }
    const inquiry = {
      id: randomUUID(),
      name,
      email,
      phone: clip(body.phone, 40),
      eventDate: clip(body.eventDate, 40),
      location: clip(body.location, 200),
      guests: clip(body.guests, 40),
      hours: clip(body.hours, 40),
      eventType: clip(body.eventType, 60),
      message: clip(body.message, 3000),
    };
    await saveInquiry(inquiry);

    // heads-up email to you (optional; the inquiry is saved either way)
    const key = process.env.RESEND_API_KEY;
    const to = process.env.EVENTS_NOTIFY_EMAIL;
    if (key && to) {
      const rows = [
        ["Name", inquiry.name],
        ["Email", inquiry.email],
        ["Phone", inquiry.phone],
        ["Event date", inquiry.eventDate],
        ["Where", inquiry.location],
        ["Guests", inquiry.guests],
        ["Hours", inquiry.hours],
        ["Type", inquiry.eventType],
        ["Details", inquiry.message],
      ]
        .filter(([, v]) => v)
        .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5d5b72">${k}</td><td style="padding:4px 0">${escapeHtml(String(v))}</td></tr>`)
        .join("");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [to],
          reply_to: inquiry.email,
          subject: `🎉 Event inquiry: ${inquiry.name}${inquiry.eventDate ? ` · ${inquiry.eventDate}` : ""}`,
          html: `<div style="font-family:Helvetica,Arial,sans-serif;color:#1a1a2e"><h2>New MeSticker event inquiry</h2><table>${rows}</table></div>`,
        }),
      }).catch((e) => console.error("[events/inquiry] email failed", e));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[events/inquiry]", e);
    return NextResponse.json({ error: "Couldn't send that. Please email hello@mesticker.fun." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!staff(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ inquiries: await listInquiries() }, { headers: { "Cache-Control": "no-store" } });
}
