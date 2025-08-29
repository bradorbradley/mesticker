import { sdk } from '@farcaster/miniapp-sdk'
import { isMiniApp } from './env'

export interface WalletAPI {
  ready(): Promise<void>
  getAddress(): Promise<string>
  signMessage(msg: string): Promise<string>
  sendTx(rawOrParams: any): Promise<string>
  disconnect?(): Promise<void>
}

class FarcasterWallet implements WalletAPI {
  async ready(): Promise<void> {
    await sdk.actions.ready()
  }

  async getAddress(): Promise<string> {
    const context = await sdk.context
    if (context.user?.custody) {
      return context.user.custody
    }
    // Fallback to wallet provider if available
    const provider = await sdk.wallet.getEthereumProvider()
    const accounts = await provider.request({ method: 'eth_requestAccounts' })
    return accounts[0]
  }

  async signMessage(msg: string): Promise<string> {
    const result = await sdk.wallet.signMessage({ message: msg })
    return result.signature
  }

  async sendTx(rawOrParams: any): Promise<string> {
    const result = await sdk.wallet.sendTransaction(rawOrParams)
    return result.transactionHash
  }
}

class WebWallet implements WalletAPI {
  private connected = false

  async ready(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Web wallet not available in SSR')
    }
    
    if (!(window as any).ethereum) {
      throw new Error('No web wallet found. Please install MetaMask or another web3 wallet.')
    }

    try {
      const accounts = await (window as any).ethereum.request({ 
        method: 'eth_requestAccounts' 
      })
      if (accounts.length > 0) {
        this.connected = true
      }
    } catch (error) {
      throw new Error('Failed to connect to web wallet')
    }
  }

  async getAddress(): Promise<string> {
    if (!this.connected) {
      await this.ready()
    }
    
    const accounts = await (window as any).ethereum.request({ 
      method: 'eth_accounts' 
    })
    
    if (accounts.length === 0) {
      throw new Error('No accounts available')
    }
    
    return accounts[0]
  }

  async signMessage(msg: string): Promise<string> {
    const address = await this.getAddress()
    const signature = await (window as any).ethereum.request({
      method: 'personal_sign',
      params: [msg, address]
    })
    return signature
  }

  async sendTx(rawOrParams: any): Promise<string> {
    const txHash = await (window as any).ethereum.request({
      method: 'eth_sendTransaction',
      params: [rawOrParams]
    })
    return txHash
  }

  async disconnect(): Promise<void> {
    this.connected = false
    // Most wallets don't support programmatic disconnect
    // User needs to disconnect from wallet extension directly
  }
}

let walletInstance: WalletAPI | null = null

export async function getWallet(): Promise<WalletAPI> {
  if (walletInstance) {
    return walletInstance
  }

  const isInMiniApp = await isMiniApp()
  
  if (isInMiniApp) {
    console.info('[wallet] using miniapp')
    walletInstance = new FarcasterWallet()
  } else {
    console.info('[wallet] using web wallet')
    walletInstance = new WebWallet()
  }
  
  return walletInstance
}