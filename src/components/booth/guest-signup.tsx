"use client";

import { useState } from "react";
import { CONSENT_TEXT } from "@/lib/consent-text";
import type { PartyEvent } from "@/lib/party-events";
import { u } from "./units";
import { primeMusic } from "./event-booth";

/**
 * Event sign-up (before printing, or on a guest's phone after a QR scan): email (stickers are
 * emailed), name, and two choices, ticked by default and easy to untick: posting their photos and
 * stickers, and marketing emails. Continuing = agreeing to the terms (the line under the button).
 */
export default function GuestSignup({
  event,
  onDone,
  onCancel,
  cta = "Print my stickers 🎄",
}: {
  cta?: string;
  event: PartyEvent;
  onDone: (g: SavedGuest) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [media, setMedia] = useState(true);
  const [marketing, setMarketing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && !!name.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    primeMusic(event.look?.music); // this tap lets the welcome video play its music
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/events/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: event.slug, email: email.trim(), name: name.trim() || null, terms: true, media, marketing }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't save");
      onDone({ id: d.guestId, token: d.token, email: email.trim(), name: name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save, try again");
      setBusy(false);
    }
  }

  const box = "mt-1 h-6 w-6 shrink-0 accent-[var(--purple,#7c5cfc)]";
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-[var(--cream,#fffaf3)]">
      <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col short:grid short:max-w-3xl short:grid-cols-2 short:gap-x-6 short:gap-y-2" style={{ gap: u(1.6), padding: `${u(2.5)} ${u(2)} ${u(4)}` }}>
        <div className="text-center short:col-span-2">
          <div className="short:hidden" style={{ fontSize: `max(40px, ${u(5)})` }}>🎄</div>
          <h1 className="font-fun font-bold" style={{ fontSize: `max(28px, ${u(3.4)})`, lineHeight: 1.1 }}>
            {event.name}
          </h1>
          <p className="t-body" style={{ marginTop: u(0.6) }}>
            Your stickers are almost ready! Where should we send your sticker pack?
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
          <span className="font-semibold">Name</span>
          <input
            autoComplete="given-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="rounded-2xl border-2 border-[var(--line,#e6e0f5)] bg-white px-4 py-3 text-lg outline-none focus:border-[var(--purple,#7c5cfc)]"
          />
        </label>

        <div className="flex flex-col rounded-2xl bg-white p-4 text-sm leading-snug short:col-span-2 short:flex-row short:gap-4 short:p-3" style={{ gap: u(1.2) }}>
          <label className="flex items-start gap-3">
            <input type="checkbox" className={box} checked={media} onChange={(e) => setMedia(e.target.checked)} />
            <span>{CONSENT_TEXT.media}</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className={box} checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span>{CONSENT_TEXT.marketing}</span>
          </label>
        </div>

        {error && <p className="text-center font-semibold text-[var(--pink,#e5487a)] short:col-span-2">{error}</p>}
        <button type="submit" className="btn btn-lg btn-main justify-center short:col-span-2" disabled={!valid || busy}>
          {busy ? "One sec…" : cta}
        </button>
        <p className="t-body text-center short:col-span-2" style={{ fontSize: `max(11px, ${u(1)})` }}>
          By continuing you agree to our{" "}
          <a href="/terms" target="_blank" className="underline">Terms</a> and{" "}
          <a href="/privacy" target="_blank" className="underline">Privacy Policy</a> and confirm you&apos;re 18+ (or a parent or guardian of everyone in the photo).
        </p>
        <button type="button" className="t-body underline short:col-span-2" onClick={onCancel}>
          Back
        </button>
      </form>
    </div>
  );
}

export type SavedGuest = { id: string; token: string; email: string; name?: string };

/** The guest signed up on this phone before (their own phone, after a QR scan). */
export function loadSavedGuest(slug: string): SavedGuest | null {
  try {
    const g = JSON.parse(localStorage.getItem(`mesticker-guest-${slug}`) || "null");
    return g?.id && g?.token ? g : null;
  } catch {
    return null;
  }
}

export function saveGuest(slug: string, g: SavedGuest) {
  try {
    localStorage.setItem(`mesticker-guest-${slug}`, JSON.stringify(g));
  } catch {}
}

/** Claim an order for a signed-up guest (retries while the booth is still saving it). */
export async function claimOrder(orderId: string, g: SavedGuest): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    const r = await fetch("/api/events/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, guestId: g.id, token: g.token }) }).catch(() => null);
    if (r?.ok) return true;
    if (r && r.status !== 404) return false;
    await new Promise((res) => setTimeout(res, 3000));
  }
  return false;
}
