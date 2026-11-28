import { timingSafeEqual } from "node:crypto";
import { notFound } from "next/navigation";
import { Lobster } from "next/font/google";
import EventAlbum from "@/components/booth/event-album";
import { eventAlbum, getCreation, madeStickersAt } from "@/lib/guests";
import { getPartyEvent } from "@/lib/party-events";

const carolFont = Lobster({ weight: "400", subsets: ["latin"], variable: "--font-carol", display: "swap" });

export const dynamic = "force-dynamic";
export const metadata = { title: "Class photo · MeSticker", robots: { index: false, follow: false } };

/**
 * After the party: the "class photo" (every guest's cartoon with their name, the hosts up front)
 * and a gallery of each real photo beside its cartoon. The link we send everyone as a thank-you.
 * Opens with a guest's private link (`?t=<their token>`, once they've made stickers) and shows guests who
 * agreed to be featured; `?key=<station key>` shows everyone (the owner's view).
 */
export default async function AlbumPage({ params, searchParams }: { params: Promise<{ event: string }>; searchParams: Promise<{ key?: string; t?: string; o?: string }> }) {
  const [{ event: slug }, { key, t, o }] = await Promise.all([params, searchParams]);
  const event = getPartyEvent(slug);
  if (!event?.look) notFound();
  const secret = process.env.MCP_SECRET ?? "";
  const a = Buffer.from(key ?? ""), b = Buffer.from(secret);
  const owner = !!secret && a.length === b.length && timingSafeEqual(a, b);
  // guests see it only once they've made their own stickers (their private link); the owner always can
  // ...by their private link, or from their own stickers page (their order's id)
  const byOrder = async () => {
    if (!o || !/^[a-zA-Z0-9-]{8,64}$/.test(o)) return false;
    const c = await getCreation(o).catch(() => null);
    return !!c && c.event === event.slug && !!c.stickerUrl;
  };
  const allowed = owner || (await madeStickersAt(t, event.slug).catch(() => false)) || (await byOrder());
  if (!allowed) {
    return (
      <main className={`${carolFont.variable} flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fbefd5] p-8 text-center text-[#3b1210]`}>
        <h1 style={{ fontFamily: "var(--font-carol), cursive", fontSize: 44, color: "#a3161c" }}>{event.name}</h1>
        <p className="text-lg font-semibold">The class photo opens once you&apos;ve made your stickers at the booth. 🎄</p>
      </main>
    );
  }
  const entries = await eventAlbum(event.slug, owner).catch(() => []);
  return (
    <div className={carolFont.variable}>
      <EventAlbum name={event.name} when={event.when ?? null} hosts={event.look.hosts.map((h) => ({ name: h.name, img: h.cut ?? h.img }))} entries={entries} owner={owner} />
    </div>
  );
}
