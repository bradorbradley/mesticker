import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { CartProvider } from "@/lib/cart";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeSticker — Turn yourself into a cartoon sticker",
  description:
    "Upload a photo, pick a cartoon style, and get custom kiss-cut stickers shipped to your door. Pixar, SpongeBob, Simpsons, and more!",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://mesticker.fun"
  ),
  openGraph: {
    title: "MeSticker — Turn yourself into a cartoon sticker",
    description:
      "Upload a photo, pick a cartoon style, and get real kiss-cut stickers shipped to your door! 🎨",
    url: "https://mesticker.fun",
    siteName: "MeSticker",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MeSticker — Photo to cartoon sticker",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MeSticker — Turn yourself into a cartoon sticker",
    description:
      "Upload a photo, pick a cartoon style, and get real kiss-cut stickers shipped to your door! 🎨",
    images: ["/og-image.png"],
    creator: "@brad_or_bradley",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#7C5CFC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-background antialiased font-body">
        <AuthProvider><CartProvider>{children}</CartProvider></AuthProvider>
      </body>
    </html>
  );
}
