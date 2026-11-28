import { Lobster } from "next/font/google";
import MyOrderStickers from "@/components/booth/my-order-stickers";

const carolFont = Lobster({ weight: "400", subsets: ["latin"], variable: "--font-carol", display: "swap" });

export const metadata = { title: "Your stickers · MeSticker", robots: { index: false, follow: false } };

/** Opened from the booth's "get your stickers" QR: this order's stickers, one tap to save them all. */
export default async function OrderStickersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className={carolFont.variable}>
      <MyOrderStickers id={id} />
    </div>
  );
}
