import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/guests";

/** One-click unsubscribe from marketing emails (the link and List-Unsubscribe header in every email). */
export const dynamic = "force-dynamic";

const page = (text: string) =>
  new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>MeSticker</title><body style="font-family:Helvetica,Arial,sans-serif;max-width:420px;margin:15vh auto;padding:0 20px;text-align:center;color:#1a1a2e"><h1 style="font-size:24px">${text}</h1><p style="color:#5d5b72">Your stickers are still yours: the link in your email keeps working.</p><p><a href="https://mesticker.fun" style="color:#7c5cfc">mesticker.fun</a></p></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );

export async function GET(request: NextRequest) {
  const g = await unsubscribe(request.nextUrl.searchParams.get("t") ?? "");
  return page(g ? "You're unsubscribed. No more offers from us." : "That link didn't work. Email us and we'll unsubscribe you.");
}

export async function POST(request: NextRequest) {
  const g = await unsubscribe(request.nextUrl.searchParams.get("t") ?? "");
  return NextResponse.json({ ok: !!g });
}
