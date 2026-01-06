import { NextResponse } from "next/server"

export async function GET() {
  const checks = {
    gemini: !!process.env.GEMINI_API_KEY,
    cloudinary: !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    printful: !!process.env.PRINTFUL_API_KEY,
    supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
  }

  const allConfigured = Object.values(checks).every(Boolean)

  return NextResponse.json({
    status: allConfigured ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: checks,
  })
}
