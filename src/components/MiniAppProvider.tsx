'use client'

import { OnchainKitProvider } from '@coinbase/onchainkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { http } from 'viem'
import { base } from 'viem/chains'
import { createConfig } from 'wagmi'
import { coinbaseWallet, metaMask, walletConnect } from 'wagmi/connectors'
import { useState } from 'react'

// Create wagmi config
const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'MeSticker',
      preference: 'smartWalletOnly',
    }),
    metaMask(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'your-project-id',
    }),
  ],
  transports: {
    [base.id]: http(),
  },
})

export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={base}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}