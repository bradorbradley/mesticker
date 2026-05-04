/**
 * Anonymous session management.
 * Generates a UUID stored in cookie + localStorage.
 * All creations are tagged with this session ID so users
 * can return later and see their gallery.
 */

import { v4 } from "./uuid";

const SESSION_KEY = "mesticker-session-id";

/** Generate or retrieve session ID (client-side) */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";

  // Check localStorage first
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) return stored;
  } catch {}

  // Generate new
  const id = v4();
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {}

  // Also set as cookie for server-side access
  document.cookie = `${SESSION_KEY}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

  return id;
}

/** Get session ID from cookie string (server-side) */
export function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${SESSION_KEY}=([^;]+)`));
  return match?.[1] || null;
}
