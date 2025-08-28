import { NextRequest, NextResponse } from 'next/server'
import { editImage } from '@/lib/openai-server'

// Add runtime configuration for Vercel
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const requestId = Math.random().toString(36).substring(7)
    console.log(`[${requestId}] Starting image generation request`)
    
    const formData = await request.formData()
    const image = formData.get('image') as File
    const style = formData.get('style') as string

    if (!image || !style) {
      console.log(`[${requestId}] Missing required fields - image: ${!!image}, style: ${!!style}`)
      return NextResponse.json({ error: 'Missing image or style' }, { status: 400 })
    }

    console.log(`[${requestId}] Processing image generation - Size: ${image.size} bytes, Style: ${style}`)

    // Create the prompt based on selected style
    const stylePrompts = {
      'Hey Arnold': 'Transform this person into Hey Arnold cartoon style with football head shape, simple lines, and 90s Nickelodeon animation aesthetic',
      'Fairly Odd Parents': 'Transform this person into Fairly Odd Parents cartoon style with angular features, bright colors, and Butch Hartman art style',
      'Scooby Doo': 'Transform this person into Scooby Doo cartoon style with classic Hanna-Barbera animation, retro colors, and simple character design',
      'SpongeBob': 'Transform this person into SpongeBob SquarePants cartoon style with nautical theme, underwater colors, and Stephen Hillenburg art style',
      'The Simpsons': 'Transform this person into The Simpsons cartoon style with yellow skin, simple lines, and Matt Groening art style',
      'Family Guy': 'Transform this person into Family Guy cartoon style with Seth MacFarlane art direction, bold lines, and modern animation',
      'Rick and Morty': 'Transform this person into Rick and Morty cartoon style with Dan Harmon and Justin Roiland art aesthetic, sci-fi elements'
    }

    const prompt = stylePrompts[style as keyof typeof stylePrompts] || 
      `Transform this person into ${style} cartoon style`

    // Use centralized editImage function
    console.log(`[${requestId}] Calling OpenAI API...`)
    const response = await editImage(image, prompt)
    console.log(`[${requestId}] OpenAI API call completed successfully`)

    if (!response.data || response.data.length === 0) {
      console.log(`[${requestId}] No image data in OpenAI response`)
      throw new Error('No image data returned from OpenAI')
    }

    // Handle response format - convert URL to base64 if needed
    const imageData = response.data[0]
    let imageBase64: string

    if (imageData.b64_json) {
      imageBase64 = imageData.b64_json
      console.log(`[${requestId}] Using b64_json from OpenAI response`)
    } else if (imageData.url) {
      // Fetch URL and convert to base64
      console.log(`[${requestId}] Fetching image from URL: ${imageData.url}`)
      const imageResponse = await fetch(imageData.url)
      const arrayBuffer = await imageResponse.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      imageBase64 = buffer.toString('base64')
      console.log(`[${requestId}] Converted URL image to base64`)
    } else {
      console.log(`[${requestId}] Unexpected response format:`, Object.keys(imageData))
      throw new Error('Unexpected response format from OpenAI')
    }

    console.log(`[${requestId}] Image generation completed - base64 length: ${imageBase64.length}`)
    return NextResponse.json({ imageBase64 })

  } catch (error: any) {
    const requestId = 'unknown'
    console.error(`[${requestId}] Stylize API Error:`, error)
    
    // Check for specific OpenAI error types
    if (error.message && error.message.includes('429')) {
      console.error(`[${requestId}] Rate limit detected!`)
      return NextResponse.json({ 
        error: 'Rate limit exceeded. Please wait a moment before trying again.', 
        details: error.message 
      }, { status: 429 })
    }
    
    if (error.message && error.message.includes('401')) {
      console.error(`[${requestId}] Authentication error detected!`)
      return NextResponse.json({ 
        error: 'API authentication failed', 
        details: error.message 
      }, { status: 401 })
    }
    
    if (error.message && error.message.includes('moderation_blocked')) {
      console.error(`[${requestId}] Content moderation block detected!`)
      return NextResponse.json({ 
        error: 'Image was rejected by content safety filters. Please try a different image.', 
        details: 'OpenAI safety system blocked this content'
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: 'Failed to generate image', 
      details: error.message 
    }, { status: 500 })
  }
}