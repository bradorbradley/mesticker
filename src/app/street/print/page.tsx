import type { Metadata } from "next";
import StreetSeller from "@/components/street/street-seller";

export const metadata: Metadata = {
  title: "MeSticker · Street printer",
  // "Add to Home Screen" opens straight to the order list
  manifest: "/street/manifest.webmanifest",
};

/** Street mode: the seller's phone, next to the Liene printer. */
export default function StreetPrintPage() {
  return <StreetSeller />;
}
