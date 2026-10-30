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
  themeColor: "#fcfaf6",
};

export default function BoothLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- booth-only fonts, hoisted by React */}
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,400..800,0..100;1,9..144,400..800,0..100&family=Instrument+Sans:wght@400..700&display=swap"
      />
      {children}
    </>
  );
}
