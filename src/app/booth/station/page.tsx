import PrintStation from "@/components/booth/print-station";

export const metadata = { title: "MeSticker Print Station", robots: { index: false, follow: false } };

/** The staff phone next to the Liene printer: guest QR + live print queue. */
export default function StationPage() {
  return <PrintStation />;
}
