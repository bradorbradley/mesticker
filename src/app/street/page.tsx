import StreetGuest from "@/components/street/street-guest";

/** Street mode: the guest's phone, opened from the seller's QR code. */
export default async function StreetPage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;
  return <StreetGuest resumeId={o && /^[a-zA-Z0-9-]{8,64}$/.test(o) ? o : undefined} />;
}
