"use client";

import { useState } from "react";
import { CONSENT_TEXT } from "@/lib/consent-text";
import type { PartyEvent } from "@/lib/party-events";
import { u } from "./units";

/**
 * Event sign-up, shown before the camera on /booth/<event>: email (stickers are emailed),
 * first name, and three separate choices. Only the terms are required; the media release and
 * marketing emails are opt-in, never pre-ticked.
 */
export default function GuestSignup({
  event,
  onDone,
  onCancel,
}: {
  event: PartyEvent;
  onDone: (g: { id: string; token: string; email: string }) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [terms, setTerms] = useState(false);
  const [media, setMedia] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && terms;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/events/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: event.slug, email: email.trim(), name: name.trim() || null, terms, media, marketing }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't save");
      onDone({ id: d.guestId, token: d.token, email: email.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save, try again");
      setBusy(false);
    }
  }

  const box = "mt-1 h-6 w-6 shrink-0 accent-[var(--purple,#7c5cfc)]";
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-[var(--cream,#fffaf3)]">
      <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col" style={{ gap: u(1.6), padding: `${u(2.5)} ${u(2)} ${u(4)}` }}>
        <div className="text-center">
          <div style={{ fontSize: `max(40px, ${u(5)})` }}>🎄</div>
          <h1 className="font-fun font-bold" style={{ fontSize: `max(28px, ${u(3.4)})`, lineHeight: 1.1 }}>
            {event.name}
          </h1>
          <p className="t-body" style={{ marginTop: u(0.6) }}>
            Free stickers tonight! Where should we send your sticker pack?
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-semibold">Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-2xl border-2 border-[var(--line,#e6e0f5)] bg-white px-4 py-3 text-lg outline-none focus:border-[var(--purple,#7c5cfc)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">
            First name <span className="font-normal text-[var(--muted,#8a86a0)]">(optional)</span>
          </span>
          <input
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="rounded-2xl border-2 border-[var(--line,#e6e0f5)] bg-white px-4 py-3 text-lg outline-none focus:border-[var(--purple,#7c5cfc)]"
          />
        </label>

        <div className="flex flex-col rounded-2xl bg-white p-4 text-sm leading-snug" style={{ gap: u(1.2) }}>
          <label className="flex items-start gap-3">
            <input type="checkbox" className={box} checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>
              <b>Required.</b> {CONSENT_TEXT.terms.split("the MeSticker Terms and Privacy Policy")[0]}the MeSticker{" "}
              <a href="/terms" target="_blank" className="font-semibold text-[var(--purple,#7c5cfc)] underline">Terms</a> and{" "}
              <a href="/privacy" target="_blank" className="font-semibold text-[var(--purple,#7c5cfc)] underline">Privacy Policy</a>
              {CONSENT_TEXT.terms.split("the MeSticker Terms and Privacy Policy")[1]}
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className={box} checked={media} onChange={(e) => setMedia(e.target.checked)} />
            <span>{CONSENT_TEXT.media}</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className={box} checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span>{CONSENT_TEXT.marketing}</span>
          </label>
        </div>

        {error && <p className="text-center font-semibold text-[var(--pink,#e5487a)]">{error}</p>}
        <button type="submit" className="btn btn-lg btn-main justify-center" disabled={!valid || busy}>
          {busy ? "One sec…" : "Take my photo 📸"}
        </button>
        <button type="button" className="t-body underline" onClick={onCancel}>
          Back
        </button>
      </form>
    </div>
  );
}
