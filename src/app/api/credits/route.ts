import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory storage (in production, use a database)
const creditsStorage = new Map<string, number>()

const FREE_CREDITS = 3

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userFid = searchParams.get('userFid')
    
    if (!userFid) {
      return NextResponse.json({ error: 'User FID required' }, { status: 400 })
    }

    // Get credits for user, default to free credits if new user
    const credits = creditsStorage.get(userFid) ?? FREE_CREDITS
    
    // Set initial credits if new user
    if (!creditsStorage.has(userFid)) {
      creditsStorage.set(userFid, FREE_CREDITS)
    }

    return NextResponse.json({ credits })
  } catch (error) {
    console.error('Credits GET error:', error)
    return NextResponse.json({ error: 'Failed to get credits' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userFid, credits, action } = await request.json()
    
    if (!userFid || typeof credits !== 'number') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (action === 'add') {
      // Add credits (from purchase)
      const currentCredits = creditsStorage.get(userFid) ?? FREE_CREDITS
      const newCredits = currentCredits + credits
      creditsStorage.set(userFid, newCredits)
      
      console.log(`Added ${credits} credits to user ${userFid}. New total: ${newCredits}`)
      return NextResponse.json({ credits: newCredits })
      
    } else if (action === 'use') {
      // Use a credit (from generation)
      const currentCredits = creditsStorage.get(userFid) ?? FREE_CREDITS
      
      if (currentCredits <= 0) {
        return NextResponse.json({ error: 'No credits available' }, { status: 400 })
      }
      
      const newCredits = currentCredits - 1
      creditsStorage.set(userFid, newCredits)
      
      console.log(`Used 1 credit for user ${userFid}. Remaining: ${newCredits}`)
      return NextResponse.json({ credits: newCredits })
      
    } else {
      // Set credits (sync)
      creditsStorage.set(userFid, credits)
      return NextResponse.json({ credits })
    }
  } catch (error) {
    console.error('Credits POST error:', error)
    return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 })
  }
}