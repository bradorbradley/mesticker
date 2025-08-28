import fetch from 'node-fetch'
import FormData from 'form-data'

export function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim()
}

export async function editImage(
  input: File | Buffer,
  prompt: string,
  opts?: { n?: number; size?: string; model?: string }
): Promise<any> {
  const { model = 'gpt-image-1', size = '1024x1024', n = 1 } = opts || {}
  
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const form = new FormData()
  
  // Handle File or Buffer input
  if (input instanceof File) {
    const arrayBuffer = await input.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    form.append('image', buffer, {
      filename: 'image.png',
      contentType: 'image/png'
    })
  } else {
    form.append('image', input, {
      filename: 'image.png',
      contentType: 'image/png'
    })
  }

  form.append('model', model)
  form.append('prompt', prompt)
  form.append('size', size)
  form.append('n', n.toString())

  try {
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders()
      },
      body: form
    })

    if (!response.ok) {
      const errorText = await response.text()
      const requestId = response.headers.get('x-request-id') || 'none'
      
      console.error('OpenAI API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        requestId
      })
      
      throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} (req: ${requestId})`)
    }

    const data = await response.json()
    return data
    
  } catch (error) {
    console.error('editImage error:', error)
    throw error
  }
}