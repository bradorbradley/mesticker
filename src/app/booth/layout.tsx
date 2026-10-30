import type { Metadata, Viewport } from "next";
import "./booth.css";

export const metadata: Metadata = {
  title: "MeSticker Booth",
  description: "Snap a photo, pick a style, and peel off your sticker in two minutes.",
  robots: { index: false, follow: false },
  // "Add to Home Screen" launches the booth full-screen, no browser bars.
  manifest: "/booth/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MeSticker", statusBarStyle: "black-translucent" },
  icons: { apple: "/booth/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#7C5CFC",
};

// Fonts (Fredoka + Nunito) come from the root layout.
export default function BoothLayout({ children }: { children: React.ReactNode }) {
  return children;
}
