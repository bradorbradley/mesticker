import Link from "next/link";
import { notFound } from "next/navigation";
import { creationsOf, guestByToken } from "@/lib/guests";
import { getPartyEvent } from "@/lib/party-events";
import { LEGAL } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata = { title: "My stickers · MeSticker", robots: { index: false, follow: false } };

/** A guest's private page (link in their email): every sticker and sheet they made at events. */
export default async function MyStickers({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await guestByToken(token);
  if (!guest) notFound();
  const creations = await creationsOf(guest.id);
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-8">
      <h1 className="font-display text-3xl font-bold">{guest.name ? `${guest.name.split(" ")[0]}'s stickers` : "Your stickers"} ✨</h1>
      <p className="mt-1 text-sm text-muted-foreground">Press and hold (or right-click) any image to save it.</p>
      {!creations.length && <p className="mt-8 text-muted-foreground">Your stickers are on their way. Check back in a few minutes.</p>}
      {creations.map((c) => {
        const event = getPartyEvent(c.event);
        const extras = c.stickers.filter((s) => s !== c.stickerUrl);
        return (
          <section key={c.orderId} className="mt-8 space-y-4">
            <h2 className="font-semibold">
              {event?.name ?? "MeSticker booth"} · {new Date(c.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </h2>
            {/* eslint-disable @next/next/no-img-element */}
            {c.stickerUrl && <img src={c.stickerUrl} alt="Your sticker" className="mx-auto w-72 max-w-full" />}
            {extras.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {extras.map((s) => (
                  <a key={s} href={s} download target="_blank">
                    <img src={s} alt="Sticker" className="w-full" />
                  </a>
                ))}
              </div>
            )}
            {c.sheets.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {c.sheets.map((s) => (
                  <a key={s} href={s} download target="_blank" className="rounded-xl border bg-white p-2">
                    <img src={s} alt="Sticker sheet" className="w-full" />
                  </a>
                ))}
              </div>
            )}
            {c.photoUrl && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Your original photo</summary>
                <img src={c.photoUrl} alt="Original photo" className="mt-2 w-48 rounded-xl" />
              </details>
            )}
            {/* eslint-enable @next/next/no-img-element */}
          </section>
        );
      })}
      <p className="mt-12 text-xs text-muted-foreground">
        Want these on a mug or shirt, or more stickers? <Link href="/" className="text-primary underline">mesticker.fun</Link>. To delete your photos and data, email {LEGAL.email}.
      </p>
    </main>
  );
}
