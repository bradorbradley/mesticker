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
    'fc:frame': 'vNext',
    'fc:frame:image': 'https://mesticker-app.vercel.app/api/frame-image',
    'fc:frame:image:aspect_ratio': '1.91:1',
    'fc:frame:button:1': 'Launch MeSticker',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': 'https://mesticker-app.vercel.app',
    'of:version': 'vNext',
    'of:accepts:xmtp': '2024-02-01',
    'of:image': 'https://mesticker-app.vercel.app/api/frame-image',
    'of:image:aspect_ratio': '1.91:1',
    'of:button:1': 'Launch MeSticker',
    'of:button:1:action': 'link',
    'of:button:1:target': 'https://mesticker-app.vercel.app',
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