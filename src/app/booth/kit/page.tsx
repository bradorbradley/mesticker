import LieneKit, { type Kit } from "@/components/booth/liene-kit";

/** Opened on the staff phone (the one running the Liene app) from the booth's kit QR. */
export default async function BoothKitPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  let kit: Kit | null = null;
  try {
    const u = new URL(m ?? "");
    const hosted = u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
    const local = process.env.NODE_ENV !== "production" && u.hostname === "localhost";
    if (hosted || local) {
      const data = await (await fetch(u, { cache: "no-store" })).json();
      if (data?.kind === "mesticker-liene-kit" && Array.isArray(data.items)) kit = data as Kit;
    }
  } catch {}
  return <LieneKit kit={kit} />;
}
