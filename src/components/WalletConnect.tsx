'use client'

import { useState, useEffect } from 'react'
import { Wallet, ConnectWallet } from '@coinbase/onchainkit/wallet'
import { Avatar, Name } from '@coinbase/onchainkit/identity'
import { sdk } from '@farcaster/miniapp-sdk'
import { useAccount } from 'wagmi'

export function WalletConnect() {
  const [isMiniApp, setIsMiniApp] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { isConnected } = useAccount()

  useEffect(() => {
    const checkIfMiniApp = async () => {
      try {
        // Check if we're in a Farcaster environment
        // Multiple ways to detect this
        const context = await Promise.race([
          sdk.context,
          new Promise((_, reject) => setTimeout(() => reject('timeout'), 1000))
        ])
        
        if (context?.client?.clientFid || context?.user?.fid) {
          setIsMiniApp(true)
        } else {
          setIsMiniApp(false)
        }
      } catch (error) {
        // If we can't access Farcaster context or it times out, we're on web
        console.log('Not in Mini App environment:', error)
        setIsMiniApp(false)
      } finally {
        setIsLoading(false)
      }
    }

    // Also check for iframe context (common in Mini Apps)
    const isInIframe = window !== window.parent
    
    if (isInIframe) {
      checkIfMiniApp()
    } else {
      // If not in iframe, likely web
      setIsMiniApp(false)
      setIsLoading(false)
    }
  }, [])

  // Don't render anything while loading or if we're in a Mini App
  if (isLoading || isMiniApp) {
    return null
  }

  // Show wallet connect for web users
  return (
    <div className="fixed top-4 right-4 z-50">
      <Wallet>
        <ConnectWallet className="min-h-[44px] px-4 py-2 bg-gradient-to-r from-[#00C2FF] to-[#0EA5E9] text-white rounded-xl font-semibold hover:from-[#0EA5E9] hover:to-[#00C2FF] transition-all duration-200 shadow-lg">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6" />
              <Name className="text-white" />
            </div>
          ) : (
            'Connect Wallet'
          )}
        </ConnectWallet>
      </Wallet>
    </div>
  )
}