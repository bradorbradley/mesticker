import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET() {
  try {
    console.log('=== OpenAI Key Test ===')
    console.log('Environment variables loaded:')
    console.log('- OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)
    console.log('- Key length:', process.env.OPENAI_API_KEY?.length)
    console.log('- Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 7))
    console.log('- NEXT_PUBLIC_TESTING_MODE:', process.env.NEXT_PUBLIC_TESTING_MODE)

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        status: 'FAILED',
        error: 'OpenAI API key not found in environment variables',
        troubleshoot: [
          '1. Check that .env.local contains: OPENAI_API_KEY=sk-your-key',
          '2. Restart your dev server after changing .env.local',
          '3. Make sure the line is not commented out with #'
        ]
      }, { status: 500 })
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Test with a simple models list call (doesn't cost credits)
    const models = await openai.models.list()
    
    // Check if gpt-image-1 is available
    const hasGptImage1 = models.data.some(model => model.id === 'gpt-image-1')
    const hasDalle2 = models.data.some(model => model.id === 'dall-e-2')

    return NextResponse.json({
      status: 'SUCCESS',
      message: '✅ OpenAI API key is active and working!',
      details: {
        keyPrefix: process.env.OPENAI_API_KEY.substring(0, 7),
        keyLength: process.env.OPENAI_API_KEY.length,
        testingMode: process.env.NEXT_PUBLIC_TESTING_MODE,
        modelsAvailable: models.data.length,
        hasGptImage1,
        hasDalle2,
        imageModels: models.data
          .filter(m => m.id.includes('dall-e') || m.id.includes('gpt-image'))
          .map(m => m.id)
      }
    })

  } catch (error: any) {
    console.error('OpenAI API Test Error:', error)
    
    return NextResponse.json({
      status: 'FAILED',
      error: error.message,
      errorCode: error?.error?.code,
      troubleshoot: [
        '1. Check if your API key is valid (starts with sk-)',
        '2. Verify you have credits/billing set up in OpenAI dashboard',
        '3. Check for any rate limits or billing issues',
        '4. Make sure the API key has permissions for image generation'
      ]
    }, { status: 500 })
  }
}