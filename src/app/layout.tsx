import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { MiniAppProvider } from '@/components/MiniAppProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MeSticker - Cartoonify Yourself',
  description: 'Transform into your favorite cartoon character and share on Farcaster!',
  metadataBase: new URL('https://mesticker-app.vercel.app'),
  openGraph: {
    title: 'MeSticker - Cartoonify Yourself',
    description: 'Transform into your favorite cartoon character and share on Farcaster!',
    images: ['/cartoon-presets/outputexample.png'],
  },
  other: {
    // Mini App embed metadata (new format) - v2
    'fc:miniapp': JSON.stringify({
      version: "1",
      imageUrl: "https://mesticker-app.vercel.app/api/frame-image",
      button: {
        title: "🎨 Create Sticker",
        action: {
          type: "launch_miniapp",
          url: "https://mesticker-app.vercel.app",
          name: "MeSticker",
          splashImageUrl: "https://mesticker-app.vercel.app/icon.png",
          splashBackgroundColor: "#ffffff"
        }
      }
    }),
    // Backward compatibility
    'fc:frame': JSON.stringify({
      version: "1",
      imageUrl: "https://mesticker-app.vercel.app/api/frame-image",
      button: {
        title: "🎨 Create Sticker",
        action: {
          type: "launch_frame",
          url: "https://mesticker-app.vercel.app",
          name: "MeSticker",
          splashImageUrl: "https://mesticker-app.vercel.app/icon.png",
          splashBackgroundColor: "#ffffff"
        }
      }
    }),
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MiniAppProvider>{children}</MiniAppProvider>
      </body>
    </html>
  )
}