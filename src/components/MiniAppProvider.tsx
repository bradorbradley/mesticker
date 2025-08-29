'use client'

// Simple wrapper component - SDK initialization is handled in page.tsx
export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}