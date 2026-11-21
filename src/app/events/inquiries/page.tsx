import { timingSafeEqual } from "node:crypto";
import { listInquiries } from "@/lib/event-inquiries";

export const metadata = { title: "Event inquiries · MeSticker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Your inbox of event booking requests: /events/inquiries?key=<MCP_SECRET> */
export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key = "" } = await searchParams;
  const secret = process.env.MCP_SECRET || "";
  const a = Buffer.from(key), b = Buffer.from(secret);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) {
    return <main className="mx-auto max-w-xl px-6 py-16 text-center text-muted-foreground">Add your key to the link: /events/inquiries?key=…</main>;
  }
  const items = await listInquiries();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">Event inquiries</h1>
      <p className="mt-1 text-muted-foreground">{items.length ? `${items.length} so far, newest first` : "None yet. Share mesticker.fun/events!"}</p>
      <div className="mt-6 grid gap-4">
        {items.map((i) => (
          <div key={i.id} className="rounded-2xl border-2 border-border bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-bold">{i.name}</h2>
              <span className="text-xs text-muted-foreground">{new Date(i.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            <p className="mt-1">
              <a className="font-semibold text-primary" href={`mailto:${i.email}`}>{i.email}</a>
              {i.phone && <span className="text-muted-foreground"> · {i.phone}</span>}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {[i.eventType, i.eventDate && `on ${i.eventDate}`, i.location && `in ${i.location}`, i.guests && `${i.guests} guests`, i.hours && `${i.hours} hrs`].filter(Boolean).join(" · ")}
            </p>
            {i.message && <p className="mt-3 whitespace-pre-wrap">{i.message}</p>}
          </div>
        ))}
      </div>
    </main>
  );
}
