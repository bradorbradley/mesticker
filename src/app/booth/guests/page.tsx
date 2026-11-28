import GuestLog from "@/components/booth/guest-log";

export const metadata = { title: "MeSticker Guests", robots: { index: false, follow: false } };

/** Owner only (station key): everyone who made stickers, their photo, sheet and stickers, and a reprint button. */
export default function GuestsPage() {
  return <GuestLog />;
}
