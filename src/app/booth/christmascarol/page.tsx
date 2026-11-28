import BoothApp from "@/components/booth/booth-app";
import { PARTY_EVENTS } from "@/lib/party-events";

export const metadata = { title: "MeSticker · Christmas Carol Party" };

/** QR code at the Christmas Carol Party: free stickers, guests sign up with their email first. */
export default function ChristmasCarolBooth() {
  return <BoothApp event={PARTY_EVENTS.christmascarol} />;
}
