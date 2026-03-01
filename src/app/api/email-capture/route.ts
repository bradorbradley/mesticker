import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

/**
 * Capture email addresses from the "+1 free generation" prompt.
 * 
 * If RESEND_API_KEY is set, adds to Resend audience.
 * Always stores in a simple append-only log as backup.
 */

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Rate limit email capture to prevent abuse
    const clientIP = getClientIP(request);
    const rateCheck = checkRateLimit(`email:${clientIP}`, 3, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    // Try Resend if configured
    const resendKey = process.env.RESEND_API_KEY;
    const audienceId = process.env.RESEND_AUDIENCE_ID;

    if (resendKey && audienceId) {
      try {
        const res = await fetch("https://api.resend.com/audiences/" + audienceId + "/contacts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            unsubscribed: false,
          }),
        });

        if (!res.ok) {
          console.warn("Resend API error:", await res.text());
        }
      } catch (e) {
        console.warn("Resend failed:", e);
      }
    }

    // Always log to console as backup (Vercel logs capture this)
    console.log(`[EMAIL_CAPTURE] ${new Date().toISOString()} ${email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email capture error:", error);
    return NextResponse.json(
      { error: "Failed to capture email" },
      { status: 500 }
    );
  }
}
