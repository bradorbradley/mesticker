'use client'

import { useEffect } from 'react'

export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const initializeMiniApp = async () => {
      if (typeof window === 'undefined') return
      
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        
        // Wait for app to be ready, then signal to Farcaster
        const readyTimer = setTimeout(() => {
          sdk.actions.ready()
        }, 1000)

        return () => {
          clearTimeout(readyTimer)
        }
      } catch (error) {
        console.log('Mini App SDK not available:', error)
      }
    }

    initializeMiniApp()
  }, [])

  return <>{children}</>
}