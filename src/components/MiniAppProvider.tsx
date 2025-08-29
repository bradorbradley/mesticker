'use client'

import { useEffect } from 'react'

export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Check if we're in a Farcaster Mini App context
    const isInMiniApp = typeof window !== 'undefined' && 
      (window.location.search.includes('miniApp=true') || 
       window.location.pathname.includes('/miniapp') ||
       window.parent !== window) // Loaded in iframe

    if (!isInMiniApp) {
      console.log('Not in mini app context, skipping SDK initialization')
      return
    }

    const initializeMiniApp = async () => {
      try {
        console.log('Loading Farcaster Mini App SDK...')
        const { sdk } = await import('@farcaster/miniapp-sdk')
        
        console.log('SDK loaded, calling ready()...')
        
        // Multiple attempts to ensure ready is called
        const callReady = async () => {
          try {
            await sdk.actions.ready()
            console.log('✅ Mini App ready() called successfully')
          } catch (error) {
            console.error('❌ Error calling ready():', error)
            // Try again after a delay
            setTimeout(callReady, 500)
          }
        }

        // Call ready immediately and also after a short delay
        callReady()
        setTimeout(callReady, 100)
        setTimeout(callReady, 500)
        
      } catch (error) {
        console.error('Failed to load Mini App SDK:', error)
      }
    }

    // Initialize when DOM is ready
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