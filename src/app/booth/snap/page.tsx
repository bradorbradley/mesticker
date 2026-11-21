import PhoneSnap from "@/components/booth/phone-snap";

/** Opened on the guest's phone from the booth's "Take from mobile" QR. */
export default async function BoothSnapPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  return <PhoneSnap code={p ?? ""} />;
}
