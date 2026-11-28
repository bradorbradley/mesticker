import type { Metadata } from "next";
import { Bangers, Lobster } from "next/font/google";
import GamesLabClient from "./lab-client";

const carolFont = Lobster({ weight: "400", subsets: ["latin"], variable: "--font-carol", display: "swap" });
const comicFont = Bangers({ weight: "400", subsets: ["latin"], variable: "--font-comic", display: "swap" });

export const metadata: Metadata = {
  title: "Carol Games Lab · MeSticker",
  robots: { index: false, follow: false },
};

/** Dev preview for the Christmas Carol mini-games. ?ms=20000 shortens the run. */
export default async function GamesLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ms = Number(Array.isArray(sp.ms) ? sp.ms[0] : sp.ms) || undefined;
  return (
    <div className={`${carolFont.variable} ${comicFont.variable}`}>
      <div className="booth theme-carol fixed inset-0">
        <GamesLabClient durationMs={ms} />
      </div>
    </div>
  );
}
