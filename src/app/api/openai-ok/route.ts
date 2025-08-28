import fetch from 'node-fetch'
import { getApiKey } from '@/lib/openai-server'

export async function GET() {
  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      return Response.json({ 
        status: 'FAILED',
        error: 'OpenAI API key not configured'
      })
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      const requestId = response.headers.get('x-request-id') || 'none'
      
      console.error('OpenAI Models API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        requestId
      })
      
      return Response.json({ 
        status: 'FAILED',
        error: `${response.status} ${response.statusText}`,
        requestId
      })
    }

    const models = await response.json() as { data: Array<{ id: string }> }
    const hasGptImage1 = models.data.some(model => model.id === 'gpt-image-1')

    return Response.json({ 
      status: 'SUCCESS',
      hasGptImage1
    })

  } catch (error: any) {
    console.error('OpenAI API Test Error:', error)
    
    return Response.json({ 
      status: 'FAILED',
      error: error.message
    })
  }
}