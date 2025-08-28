export async function GET() {
  return Response.json({ hasKey: !!process.env.OPENAI_API_KEY })
}