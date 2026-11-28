import StreetDone from "@/components/street/street-done";

/** The guest's phone after paying (Stripe's success page, or cash). */
export default async function StreetDonePage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;
  return <StreetDone id={o && /^[a-zA-Z0-9-]{8,64}$/.test(o) ? o : ""} />;
}
