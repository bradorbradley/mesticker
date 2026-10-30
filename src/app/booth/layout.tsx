import type { Metadata, Viewport } from "next";
import "./booth.css";

export const metadata: Metadata = {
  title: "MeSticker Booth",
  description: "Snap a photo, pick a style, and peel off your sticker in two minutes.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#7C5CFC",
};

// Fonts (Fredoka + Nunito) come from the root layout.
export default function BoothLayout({ children }: { children: React.ReactNode }) {
  return children;
}
