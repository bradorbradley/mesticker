import GetSticker from "@/components/booth/get-sticker";

/** Opened on the guest's phone from the booth QR code or the email. */
export default async function BoothGetPage({ searchParams }: { searchParams: Promise<{ u?: string; e?: string; o?: string }> }) {
  const { u, e, o } = await searchParams;
  return <GetSticker url={u ?? ""} eventSlug={e} orderId={o} />;
}
