import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File
    const style = formData.get('style') as string

    if (!image || !style) {
      return NextResponse.json({ error: 'Missing image or style' }, { status: 400 })
    }

    console.log('Environment check:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      keyLength: process.env.OPENAI_API_KEY?.length,
      keyPrefix: process.env.OPENAI_API_KEY?.substring(0, 7),
      testingMode: process.env.NEXT_PUBLIC_TESTING_MODE
    })

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    // Initialize OpenAI client at runtime
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

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

    console.log('Editing image with OpenAI DALL-E...', { style, prompt: prompt.substring(0, 100) + '...' })

    // Convert File to ArrayBuffer for OpenAI API
    const arrayBuffer = await image.arrayBuffer()
    const imageFile = new File([arrayBuffer], 'image.png', { type: 'image/png' })

    // Use GPT-Image-1 to transform the existing image
    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
      input_fidelity: 'high',
      output_format: 'png'
    })

    console.log('OpenAI response structure:', {
      hasData: !!response.data,
      dataLength: response.data?.length,
      firstItem: response.data?.[0] ? Object.keys(response.data[0]) : null
    })

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from OpenAI')
    }

    // For gpt-image-1, the response structure might be different
    const imageData = response.data[0]
    let imageBase64: string

    if (imageData.b64_json) {
      imageBase64 = imageData.b64_json
    } else if (imageData.revised_prompt && imageData.url) {
      // If it returns URL format, fetch and convert to base64
      const imageResponse = await fetch(imageData.url)
      const arrayBuffer = await imageResponse.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      imageBase64 = buffer.toString('base64')
    } else {
      console.error('Unexpected response format:', imageData)
      throw new Error('Unexpected response format from OpenAI')
    }

    console.log('Image generated successfully, base64 length:', imageBase64.length)

    return NextResponse.json({ imageBase64 })

  } catch (error: any) {
    console.error('Stylize API Error:', error)
    
    if (error?.error?.code === 'invalid_api_key') {
      return NextResponse.json({ error: 'Invalid OpenAI API key' }, { status: 401 })
    }
    
    if (error?.error?.code === 'insufficient_quota') {
      return NextResponse.json({ error: 'OpenAI quota exceeded' }, { status: 429 })
    }

    return NextResponse.json({ 
      error: 'Failed to generate image', 
      details: error.message 
    }, { status: 500 })
  }
}