import { useState, useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

export interface CreditPackage {
  credits: number
  price: number
  label: string
  savings?: string
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { credits: 5, price: 5, label: "5 Credits" },
  { credits: 10, price: 8, label: "10 Credits", savings: "Save $2" },
  { credits: 15, price: 11, label: "15 Credits", savings: "Save $4" }
]

const DEFAULT_STORAGE_KEY = 'mesticker_credits'
const FREE_CREDITS = 1

export function useCredits() {
  const [credits, setCredits] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [userFid, setUserFid] = useState<number | null>(null)
  const [storageKey, setStorageKey] = useState<string>(DEFAULT_STORAGE_KEY)

  // Initialize user and credits
  useEffect(() => {
    const initializeUser = async () => {
      try {
        // Try to get the current user from Farcaster SDK
        const context = await sdk.context
        if (context?.user?.fid) {
          const fid = context.user.fid
          setUserFid(fid)
          const userStorageKey = `mesticker_credits_${fid}`
          setStorageKey(userStorageKey)
          
          // Load credits for this specific user (simplified)
          const stored = localStorage.getItem(userStorageKey)
          if (stored) {
            setCredits(parseInt(stored))
          } else {
            // New user gets free credits
            setCredits(FREE_CREDITS)
            localStorage.setItem(userStorageKey, FREE_CREDITS.toString())
          }
        } else {
          // No user logged in, use default storage
          const stored = localStorage.getItem(DEFAULT_STORAGE_KEY)
          if (stored) {
            setCredits(parseInt(stored))
          } else {
            setCredits(FREE_CREDITS)
            localStorage.setItem(DEFAULT_STORAGE_KEY, FREE_CREDITS.toString())
          }
        }
      } catch (error) {
        console.error('Failed to initialize user context:', error)
        // Fallback to default storage
        const stored = localStorage.getItem(DEFAULT_STORAGE_KEY)
        if (stored) {
          setCredits(parseInt(stored))
        } else {
          setCredits(FREE_CREDITS)
          localStorage.setItem(DEFAULT_STORAGE_KEY, FREE_CREDITS.toString())
        }
      } finally {
        setIsLoading(false)
      }
    }

    initializeUser()
  }, [])

  const addCredits = (amount: number) => {
    // Simple local storage approach for now
    const newCredits = credits + amount
    setCredits(newCredits)
    localStorage.setItem(storageKey, newCredits.toString())
  }

  const useCredit = () => {
    // Simple local storage approach for now
    if (credits > 0) {
      const newCredits = credits - 1
      setCredits(newCredits)
      localStorage.setItem(storageKey, newCredits.toString())
      return true
    }
    return false
  }

  const hasCredits = credits > 0
  const isFreeUser = credits <= FREE_CREDITS && credits > 0

  return {
    credits,
    isLoading,
    hasCredits,
    isFreeUser,
    addCredits,
    useCredit,
    freeCredits: FREE_CREDITS,
    userFid
  }
}