import PhoneSnap from "@/components/booth/phone-snap";

/** Opened on the guest's phone from the booth's "Take from mobile" QR. */
export default async function BoothSnapPage({ searchParams }: { searchParams: Promise<{ p?: string; e?: string }> }) {
  const { p, e } = await searchParams;
  return <PhoneSnap code={p ?? ""} eventSlug={e} />;
}
