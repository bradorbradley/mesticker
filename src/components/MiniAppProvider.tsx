'use client'

import { useEffect, useState } from 'react'

export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const initializeMiniApp = async () => {
      if (typeof window === 'undefined') return
      
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        
        console.log('Mini App SDK loaded, calling ready...')
        
        // Call ready immediately
        await sdk.actions.ready()
        setIsReady(true)
        console.log('Mini App ready signal sent')
        
      } catch (error) {
        console.log('Mini App SDK not available:', error)
        setIsReady(true) // Still show the app even if SDK fails
      }
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeMiniApp)
    } else {
      initializeMiniApp()
    }

    return () => {
      document.removeEventListener('DOMContentLoaded', initializeMiniApp)
    }
  }, [])

  return <>{children}</>
}