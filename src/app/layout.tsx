import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MeSticker - Custom AI Stickers',
  description: 'Turn your photos into custom AI-generated stickers. Choose from 6 unique styles and get premium stickers shipped to your door.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'MeSticker - Custom AI Stickers',
    description: 'Turn your photos into custom AI-generated stickers. Choose from 6 unique styles and get premium stickers shipped to your door.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MeSticker - Custom AI Stickers',
    description: 'Turn your photos into custom AI-generated stickers.',
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
        {children}
      </body>
    </html>
  )
}
