import { timingSafeEqual } from "node:crypto";
import { notFound } from "next/navigation";
import { Lobster } from "next/font/google";
import EventAlbum from "@/components/booth/event-album";
import { eventAlbum } from "@/lib/guests";
import { getPartyEvent } from "@/lib/party-events";

const carolFont = Lobster({ weight: "400", subsets: ["latin"], variable: "--font-carol", display: "swap" });

export const dynamic = "force-dynamic";
export const metadata = { title: "Class photo · MeSticker", robots: { index: false, follow: false } };

/**
 * After the party: the "class photo" (every guest's cartoon with their name, the hosts up front)
 * and a gallery of each real photo beside its cartoon. The link we send everyone as a thank-you.
 * Shows guests who agreed to be featured; `?key=<station key>` shows everyone (the owner's log).
 */
export default async function AlbumPage({ params, searchParams }: { params: Promise<{ event: string }>; searchParams: Promise<{ key?: string }> }) {
  const [{ event: slug }, { key }] = await Promise.all([params, searchParams]);
  const event = getPartyEvent(slug);
  if (!event?.look) notFound();
  const secret = process.env.MCP_SECRET ?? "";
  const a = Buffer.from(key ?? ""), b = Buffer.from(secret);
  const owner = !!secret && a.length === b.length && timingSafeEqual(a, b);
  const entries = await eventAlbum(event.slug, owner).catch(() => []);
  return (
    <div className={carolFont.variable}>
      <EventAlbum name={event.name} when={event.when ?? null} hosts={event.look.hosts.map((h) => ({ name: h.name, img: h.cut ?? h.img }))} entries={entries} owner={owner} />
    </div>
  );
}
