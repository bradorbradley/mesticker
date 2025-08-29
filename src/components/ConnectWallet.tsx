'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wallet, LogOut } from 'lucide-react'
import { isMiniApp } from '@/lib/env'
import { getWallet } from '@/lib/wallet'

export default function ConnectWallet() {
  const [isInMiniApp, setIsInMiniApp] = useState<boolean | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkEnvironment = async () => {
      const inMiniApp = await isMiniApp()
      setIsInMiniApp(inMiniApp)
      
      if (inMiniApp) {
        // In mini app - auto-initialize
        try {
          const wallet = await getWallet()
          await wallet.ready()
          const addr = await wallet.getAddress()
          setAddress(addr)
          setIsConnected(true)
        } catch (error) {
          console.error('Mini app wallet initialization failed:', error)
        }
      }
    }
    
    checkEnvironment()
  }, [])

  const handleConnect = async () => {
    if (isInMiniApp) return // Should not happen
    
    setConnecting(true)
    setError(null)
    
    try {
      const wallet = await getWallet()
      await wallet.ready()
      const addr = await wallet.getAddress()
      setAddress(addr)
      setIsConnected(true)
    } catch (error: any) {
      console.error('Web wallet connection failed:', error)
      setError(error.message || 'Failed to connect wallet')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      const wallet = await getWallet()
      if (wallet.disconnect) {
        await wallet.disconnect()
      }
      setIsConnected(false)
      setAddress(null)
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Don't render anything in mini app
  if (isInMiniApp === null) {
    return null // Loading
  }
  
  if (isInMiniApp) {
    return null // In Farcaster mini app, no connect UI needed
  }

  // Web browser UI
  if (!isConnected) {
    return (
      <Card className="card mb-6">
        <CardContent className="card-content">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl mx-auto flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Connect Your Wallet</h3>
              <p className="text-gray-600 text-sm mb-4">
                Connect your wallet to start creating cartoon stickers
              </p>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 rounded-xl"
            >
              {connecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </>
              )}
            </Button>
            
            <p className="text-xs text-gray-500">
              💡 Tip: This app also runs inside Farcaster for 1-tap wallet actions
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Connected state
  return (
    <Card className="card mb-6">
      <CardContent className="card-content">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <div>
              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                Connected
              </Badge>
              <p className="text-sm font-mono text-gray-600 mt-1">
                {address && formatAddress(address)}
              </p>
            </div>
          </div>
          
          <Button
            onClick={handleDisconnect}
            variant="outline"
            size="sm"
            className="text-gray-500 hover:text-gray-700"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}