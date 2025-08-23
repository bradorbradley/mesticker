import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File
    const style = formData.get('style') as string

    if (!image || !style) {
      return NextResponse.json({ error: 'Missing image or style' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    // Convert file to base64
    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')

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

    console.log('Generating image with OpenAI DALL-E...', { style, prompt: prompt.substring(0, 100) + '...' })

    // Generate image with DALL-E
    const response = await openai.images.edit({
      image: buffer,
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url'
    })

    if (!response.data || !response.data[0]?.url) {
      throw new Error('No image generated from OpenAI')
    }

    const imageUrl = response.data[0].url
    console.log('Image generated successfully:', imageUrl)

    return NextResponse.json({ imageUrl })

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