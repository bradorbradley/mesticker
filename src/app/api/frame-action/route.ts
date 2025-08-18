import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate Frame action
    if (!body.trustedData?.messageBytes) {
      return NextResponse.json({ error: 'Invalid frame action' }, { status: 400 })
    }

    // Redirect to the main app
    const baseUrl = 'https://mesticker-app.vercel.app'
    
    return NextResponse.json({
      type: 'frame',
      frameUrl: baseUrl,
    })
    
  } catch (error) {
    console.error('Frame action error:', error)
    
    // Fallback response - redirect to main app
    const baseUrl = 'https://mesticker-app.vercel.app'
    
    return NextResponse.json({
      type: 'frame', 
      frameUrl: baseUrl,
    })
  }
}