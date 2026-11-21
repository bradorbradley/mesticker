import { getDb } from "@/lib/db";

/** "Book MeSticker for your event" requests from /events. Neon, or memory in dev. */
export interface EventInquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  eventDate: string | null;
  location: string | null;
  guests: string | null;
  hours: string | null;
  eventType: string | null;
  message: string | null;
  createdAt: string;
}

const inMemory = () => !process.env.DATABASE_URL;
const mem = (): EventInquiry[] => (((globalThis as Record<string, unknown>).__eventInquiries ??= []) as EventInquiry[]);

let ready: Promise<unknown> | null = null;
function ensureTable() {
  ready ??= getDb()`
    CREATE TABLE IF NOT EXISTS event_inquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      event_date TEXT,
      location TEXT,
      guests TEXT,
      hours TEXT,
      event_type TEXT,
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export async function saveInquiry(i: Omit<EventInquiry, "createdAt">) {
  if (inMemory()) return void mem().unshift({ ...i, createdAt: new Date().toISOString() });
  await ensureTable();
  await getDb()`
    INSERT INTO event_inquiries (id, name, email, phone, event_date, location, guests, hours, event_type, message)
    VALUES (${i.id}, ${i.name}, ${i.email}, ${i.phone}, ${i.eventDate}, ${i.location}, ${i.guests}, ${i.hours}, ${i.eventType}, ${i.message})
  `;
}

export async function listInquiries(limit = 200): Promise<EventInquiry[]> {
  if (inMemory()) return mem().slice(0, limit);
  await ensureTable();
  const rows = (await getDb()`SELECT * FROM event_inquiries ORDER BY created_at DESC LIMIT ${limit}`) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    email: String(r.email),
    phone: (r.phone as string) ?? null,
    eventDate: (r.event_date as string) ?? null,
    location: (r.location as string) ?? null,
    guests: (r.guests as string) ?? null,
    hours: (r.hours as string) ?? null,
    eventType: (r.event_type as string) ?? null,
    message: (r.message as string) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}
