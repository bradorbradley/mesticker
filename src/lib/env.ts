import { sdk } from '@farcaster/miniapp-sdk'

export async function isMiniApp(): Promise<boolean> {
  try {
    await sdk.actions.ready({ timeoutMs: 1500 })
    return true
  } catch {
    return false
  }
}