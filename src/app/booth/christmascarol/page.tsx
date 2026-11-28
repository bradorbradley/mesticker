import { Lobster } from "next/font/google";
import BoothApp from "@/components/booth/booth-app";
import { PARTY_EVENTS } from "@/lib/party-events";

// the invite's retro script, for headings, the ribbon and the welcome video
const carolFont = Lobster({ weight: "400", subsets: ["latin"], variable: "--font-carol", display: "swap" });

export const metadata = { title: "387 Christmas Carols · MeSticker" };

/** 387 Christmas Carols (December 4): the booth themed for the hosts, free, one sheet. */
export default function ChristmasCarolBooth() {
  return (
    <div className={carolFont.variable}>
      <BoothApp event={PARTY_EVENTS.christmascarol} />
    </div>
  );
}
