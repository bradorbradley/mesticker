import { NextRequest, NextResponse } from "next/server";
import { CONSENT_TEXT, CONSENT_VERSION } from "@/lib/consent-text";
import { signUpGuest, validEmail } from "@/lib/guests";
import { getPartyEvent } from "@/lib/party-events";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

/**
 * Event sign-up from the booth (before the camera).
 *   POST { event, email, name?, terms: true, media: bool, marketing: bool } → { guestId, token }
 * The consent wording logged is the server's copy (CONSENT_TEXT), never the browser's.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  if (!checkRateLimit(`event-guest:${ip}`, 120, 60 * 60 * 1000).allowed) return NextResponse.json({ error: "Too many sign-ups, try again soon" }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const event = getPartyEvent(body.event);
  if (!event?.collectGuest) return NextResponse.json({ error: "Unknown event" }, { status: 404 });
  if (!validEmail(body.email)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  if (typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (body.terms !== true) return NextResponse.json({ error: "Please agree to the terms to continue" }, { status: 400 });
  try {
    const consents = (["terms", "media", "marketing"] as const).map((kind) => ({ kind, given: body[kind] === true, text: `[${CONSENT_VERSION}] ${CONSENT_TEXT[kind]}` }));
    const g = await signUpGuest({ email: body.email, name: typeof body.name === "string" ? body.name : null, event: event.slug, consents, ip, userAgent: request.headers.get("user-agent") });
    return NextResponse.json({ guestId: g.id, token: g.token });
  } catch (e) {
    console.error("[events/guest] failed:", e);
    return NextResponse.json({ error: "Couldn't save, please try again" }, { status: 500 });
  }
}
