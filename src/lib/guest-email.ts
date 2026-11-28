import { getCreation, getGuest, markEmailed, type Creation, type Guest } from "@/lib/guests";
import { getPartyEvent } from "@/lib/party-events";
import { LEGAL } from "@/lib/legal";

/**
 * "Here are your stickers" email for event guests (Resend). Needs RESEND_API_KEY and a sender on a
 * domain verified in Resend (BOOTH_EMAIL_FROM, e.g. "MeSticker <stickers@mesticker.fun>").
 * Until then emails wait (guest_creations.emailed_at is empty) and go out from /booth/admin.
 */
const SITE = (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost") ? process.env.NEXT_PUBLIC_APP_URL : "https://mesticker.fun").replace(/\/$/, "");
const FROM = () => process.env.BOOTH_EMAIL_FROM || process.env.GUEST_EMAIL_FROM;
export const guestEmailReady = () => !!process.env.RESEND_API_KEY && !!FROM();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function guestEmail(guest: Guest, c: Creation) {
  const event = getPartyEvent(c.event);
  const gallery = `${SITE}/my/${guest.token}`;
  const unsub = `${SITE}/api/events/unsubscribe?t=${guest.token}`;
  const hi = guest.name ? `${esc(guest.name.split(" ")[0])}, here` : "Here";
  const extras = c.stickers.filter((u) => u !== c.stickerUrl).slice(0, 6);
  const subject = event ? `Your ${event.name} stickers are here ✨` : "Your MeSticker stickers are here ✨";
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:auto;text-align:center;color:#1a1a2e;padding:8px">
  <h1 style="font-size:26px;margin:20px 0 6px">${hi} are your stickers! ✨</h1>
  <p style="color:#5d5b72;margin:0 0 18px">Thanks for stopping by the MeSticker booth${event ? ` at the ${esc(event.name)}` : ""}.</p>
  ${c.stickerUrl ? `<img src="${c.stickerUrl}" alt="Your sticker" width="320" style="max-width:100%;height:auto" />` : ""}
  ${extras.length ? `<div style="margin:12px 0">${extras.map((u) => `<img src="${u}" alt="" width="84" style="width:84px;height:auto;margin:4px" />`).join("")}</div>` : ""}
  <p style="margin:22px 0"><a href="${gallery}" style="background:#7c5cfc;color:#fff;padding:14px 26px;border-radius:999px;text-decoration:none;font-weight:bold">See and save all your stickers</a></p>
  <p style="color:#5d5b72;font-size:14px">Your sticker character can go on mugs, shirts and more. Make more anytime at <a href="${SITE}" style="color:#7c5cfc">mesticker.fun</a>.</p>
  <p style="color:#9c99a6;font-size:11px;margin-top:28px;line-height:1.5">You're getting this because you signed up at the MeSticker booth.
  ${guest.marketingConsent && !guest.unsubscribedAt ? `<a href="${unsub}" style="color:#9c99a6">Unsubscribe from offers</a> · ` : ""}<a href="${SITE}/privacy" style="color:#9c99a6">Privacy</a> · Questions or delete my data: ${LEGAL.email}<br/>${LEGAL.business}</p>
</div>`;
  return { subject, html, gallery, unsub };
}

export async function sendGuestEmail(guest: Guest, c: Creation): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !FROM()) return { sent: false, error: "email not set up" };
  const { subject, html, unsub } = guestEmail(guest, c);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM(),
      to: [guest.email],
      subject,
      html,
      headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  if (!res.ok) return { sent: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { sent: true };
}

/** Email a guest their creation once it's saved and theirs (no-op otherwise, or if already sent). */
export async function deliverCreation(orderId: string) {
  const c = await getCreation(orderId);
  if (!c?.ready || !c.guestId || c.emailedAt || !guestEmailReady()) return;
  const guest = await getGuest(c.guestId);
  if (!guest) return;
  const r = await sendGuestEmail(guest, c);
  if (r.sent) await markEmailed(orderId);
  else console.error("[guest-email] failed:", r.error);
}
