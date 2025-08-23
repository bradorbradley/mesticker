import { useState, useEffect } from 'react'

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

const STORAGE_KEY = 'mesticker_credits'
const FREE_CREDITS = 3

export function useCredits() {
  const [credits, setCredits] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setCredits(parseInt(stored))
    } else {
      setCredits(FREE_CREDITS)
      localStorage.setItem(STORAGE_KEY, FREE_CREDITS.toString())
    }
    setIsLoading(false)
  }, [])

  const addCredits = (amount: number) => {
    const newCredits = credits + amount
    setCredits(newCredits)
    localStorage.setItem(STORAGE_KEY, newCredits.toString())
  }

  const useCredit = () => {
    if (credits > 0) {
      const newCredits = credits - 1
      setCredits(newCredits)
      localStorage.setItem(STORAGE_KEY, newCredits.toString())
      return true
    }
    return false
  }

  const hasCredits = credits > 0
  const isFreeUser = credits <= FREE_CREDITS

  return {
    credits,
    isLoading,
    hasCredits,
    isFreeUser,
    addCredits,
    useCredit,
    freeCredits: FREE_CREDITS
  }
}