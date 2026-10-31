import GetSticker from "@/components/booth/get-sticker";

/** Opened on the guest's phone from the booth QR code or the email. */
export default async function BoothGetPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  return <GetSticker url={u ?? ""} />;
}
