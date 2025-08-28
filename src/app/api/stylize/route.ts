import { NextRequest, NextResponse } from 'next/server'
import { editImage } from '@/lib/openai-server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File
    const style = formData.get('style') as string

    if (!image || !style) {
      return NextResponse.json({ error: 'Missing image or style' }, { status: 400 })
    }

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
    const response = await editImage(image, prompt)

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from OpenAI')
    }

    // Handle response format - convert URL to base64 if needed
    const imageData = response.data[0]
    let imageBase64: string

    if (imageData.b64_json) {
      imageBase64 = imageData.b64_json
    } else if (imageData.url) {
      // Fetch URL and convert to base64
      const imageResponse = await fetch(imageData.url)
      const arrayBuffer = await imageResponse.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      imageBase64 = buffer.toString('base64')
    } else {
      throw new Error('Unexpected response format from OpenAI')
    }

    return NextResponse.json({ imageBase64 })

  } catch (error: any) {
    console.error('Stylize API Error:', error)
    
    return NextResponse.json({ 
      error: 'Failed to generate image', 
      details: error.message 
    }, { status: 500 })
  }
}