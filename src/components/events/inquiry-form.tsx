"use client";

import { useState } from "react";
import { Loader2, PartyPopper } from "lucide-react";

const EVENT_TYPES = ["Wedding", "Birthday party", "Bar / Bat Mitzvah", "Corporate event", "Brand activation / pop-up", "School or community", "Other"];

/** "Book MeSticker for your event": saves to /api/events/inquiry. */
export default function InquiryForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch("/api/events/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-8 text-center">
        <PartyPopper className="mx-auto mb-3 text-primary" size={36} />
        <h3 className="font-display text-2xl font-bold">Got it, thank you!</h3>
        <p className="mt-2 text-muted-foreground">We&apos;ll get back to you within 1–2 business days with availability and a quote.</p>
      </div>
    );
  }

  const field = "w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-base outline-none transition-colors focus:border-primary";
  const label = "mb-1 block text-sm font-semibold";
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {/* honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div>
        <label className={label} htmlFor="ev-name">Your name *</label>
        <input id="ev-name" name="name" required autoComplete="name" className={field} />
      </div>
      <div>
        <label className={label} htmlFor="ev-email">Email *</label>
        <input id="ev-email" name="email" type="email" required autoComplete="email" className={field} />
      </div>
      <div>
        <label className={label} htmlFor="ev-phone">Phone</label>
        <input id="ev-phone" name="phone" type="tel" autoComplete="tel" className={field} />
      </div>
      <div>
        <label className={label} htmlFor="ev-date">Event date</label>
        <input id="ev-date" name="eventDate" type="date" className={field} />
      </div>
      <div>
        <label className={label} htmlFor="ev-type">Type of event</label>
        <select id="ev-type" name="eventType" className={field} defaultValue="">
          <option value="" disabled>
            Pick one
          </option>
          {EVENT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="ev-where">Where (city or venue)</label>
        <input id="ev-where" name="location" className={field} />
      </div>
      <div>
        <label className={label} htmlFor="ev-guests">How many guests?</label>
        <input id="ev-guests" name="guests" inputMode="numeric" placeholder="e.g. 120" className={field} />
      </div>
      <div>
        <label className={label} htmlFor="ev-hours">How many hours?</label>
        <input id="ev-hours" name="hours" placeholder="e.g. 3" className={field} />
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="ev-msg">Tell us about it</label>
        <textarea id="ev-msg" name="message" rows={4} placeholder="The vibe, the crowd, anything special (custom branding on the sheets, a theme…)" className={field} />
      </div>
      {state === "error" && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-lg font-bold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-60 sm:col-span-2"
      >
        {state === "sending" ? <Loader2 className="animate-spin" size={20} /> : null}
        {state === "sending" ? "Sending…" : "Check availability"}
      </button>
      <p className="text-center text-xs text-muted-foreground sm:col-span-2">No commitment. We reply within 1–2 business days.</p>
    </form>
  );
}
