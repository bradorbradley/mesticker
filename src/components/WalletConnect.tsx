'use client'

import { useState, useEffect } from 'react'
import { Wallet, ConnectWallet } from '@coinbase/onchainkit/wallet'
import { Avatar, Name } from '@coinbase/onchainkit/identity'
import { sdk } from '@farcaster/miniapp-sdk'
import { useAccount } from 'wagmi'

export function WalletConnect() {
  const [isMiniApp, setIsMiniApp] = useState(false)
  const { isConnected } = useAccount()

  useEffect(() => {
    // Check if we're in a Mini App by looking for specific indicators
    const checkIfMiniApp = () => {
      try {
        // Check for Farcaster-specific indicators
        const userAgent = navigator.userAgent.toLowerCase()
        const isFarcasterApp = userAgent.includes('farcaster') || 
                              userAgent.includes('warpcast') ||
                              window.location.href.includes('farcaster.xyz')
        
        // Check if we're in an iframe (common for Mini Apps)
        const isInIframe = window !== window.parent
        
        setIsMiniApp(isFarcasterApp || (isInIframe && window.location.href.includes('farcaster')))
      } catch (error) {
        // Default to showing wallet connect if we can't detect
        setIsMiniApp(false)
      }
    }

    checkIfMiniApp()
  }, [])

  // Show wallet connect for web users (default to showing it)
  if (isMiniApp) {
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