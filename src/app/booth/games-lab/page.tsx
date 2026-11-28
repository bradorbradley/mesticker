import type { Metadata } from "next";
import { Bangers, Lobster } from "next/font/google";
import GamesLabClient from "./lab-client";

const carolFont = Lobster({ weight: "400", subsets: ["latin"], variable: "--font-carol", display: "swap" });
const comicFont = Bangers({ weight: "400", subsets: ["latin"], variable: "--font-comic", display: "swap" });

export const metadata: Metadata = {
  title: "Carol Games Lab · MeSticker",
  robots: { index: false, follow: false },
};

/** Dev preview for the Christmas Carol mini-games. ?ms=20000 sets the play budget, ?only=0|1|2 plays one game. */
export default async function GamesLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  const ms = Number(one("ms")) || undefined;
  const onlyRaw = one("only");
  const only = onlyRaw != null && onlyRaw !== "" && !Number.isNaN(Number(onlyRaw)) ? Number(onlyRaw) : undefined;
  return (
    <div className={`${carolFont.variable} ${comicFont.variable}`}>
      <div className="booth theme-carol fixed inset-0">
        <GamesLabClient durationMs={ms} only={only} />
      </div>
    </div>
  );
}
