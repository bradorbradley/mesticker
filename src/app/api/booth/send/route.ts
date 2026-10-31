import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

/**
 * Email a guest their sticker.
 *
 *   GET  → { email: boolean } — whether email sending is configured
 *   POST { imageUrl, email? , sessionId? } — send to the typed address, or to
 *        the address they paid with (looked up from Stripe, never sent to the
 *        kiosk).
 *
 * Needs RESEND_API_KEY and a verified sending domain (BOOTH_EMAIL_FROM,
 * default "MeSticker <stickers@mesticker.fun>").
 */

const FROM = process.env.BOOTH_EMAIL_FROM || "MeSticker <stickers@mesticker.fun>";

function allowedImage(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname.endsWith(".public.blob.vercel-storage.com") || u.hostname.endsWith("mesticker.fun"));
  } catch {
    return false;
  }
}

function origin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  return `${request.headers.get("x-forwarded-proto") || "https"}://${host}`;
}

export async function GET() {
  return NextResponse.json({ email: !!process.env.RESEND_API_KEY });
}

export async function POST(request: NextRequest) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Email is not set up" }, { status: 501 });

  const rate = checkRateLimit(`booth-send:${getClientIP(request)}`, 60, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many emails, try again later" }, { status: 429 });

  try {
    const { imageUrl, email, sessionId } = await request.json();
    if (!imageUrl || !allowedImage(imageUrl)) {
      return NextResponse.json({ error: "Invalid image" }, { status: 400 });
    }

    let to: string | null = typeof email === "string" ? email.trim() : null;
    if (!to && typeof sessionId === "string" && sessionId.startsWith("cs_")) {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") to = session.customer_details?.email ?? null;
    }
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    }

    const page = `${origin(request)}/booth/get?u=${encodeURIComponent(imageUrl)}`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: "Your MeSticker is here! ✨",
        html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:auto;text-align:center;color:#1a1a2e">
  <h1 style="font-size:28px;margin:24px 0 8px">Here's your sticker! ✨</h1>
  <p style="color:#5d5b72;margin:0 0 20px">Thanks for stopping by the MeSticker booth. Save it, share it, make it your profile pic.</p>
  <img src="${imageUrl}" alt="Your sticker" width="360" style="max-width:100%;height:auto" />
  <p style="margin:24px 0"><a href="${page}" style="background:#7c5cfc;color:#fff;padding:14px 26px;border-radius:999px;text-decoration:none;font-weight:bold">Save to my phone</a></p>
  <p style="color:#9c99a6;font-size:12px">Want more? Make stickers anytime at <a href="https://mesticker.fun" style="color:#7c5cfc">mesticker.fun</a></p>
</div>`,
        attachments: [{ filename: "mesticker.png", path: imageUrl }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("[booth/send] resend error", res.status, detail);
      return NextResponse.json({ error: "Couldn't send the email" }, { status: 502 });
    }
    // Only tell the kiosk a masked address
    const [user, domain] = to.split("@");
    return NextResponse.json({ sent: true, to: `${user.slice(0, 2)}•••@${domain}` });
  } catch (error) {
    console.error("[booth/send]", error);
    return NextResponse.json({ error: "Couldn't send the email" }, { status: 500 });
  }
}
