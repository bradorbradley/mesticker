import type { Metadata, Viewport } from "next";
import "../booth/booth.css";

export const metadata: Metadata = {
  title: "MeSticker · Stickers of you, printed right here",
  description: "Snap a selfie and get a sheet of stickers of you, printed on the spot.",
  robots: { index: false, follow: false },
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

export default function StreetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
