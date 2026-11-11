import { NextRequest, NextResponse } from "next/server";
import { uploadJson } from "@/lib/storage";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

/**
 * A Liene kit: the numbered sheet guide + the 8 images (already uploaded),
 * saved as a small JSON file so staff can open it on the phone that runs the
 * Liene app (/booth/kit?m=…) and save the images to Photos.
 */

const isHosted = (url: unknown): url is string => {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && (u.hostname.endsWith(".public.blob.vercel-storage.com") || u.hostname.endsWith("mesticker.fun"));
  } catch {
    return false;
  }
};
const isLocal = (url: unknown) => process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?\//.test(String(url));
const okUrl = (url: unknown): url is string => isHosted(url) || isLocal(url);

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`booth-kit:${getClientIP(request)}`, 200, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  try {
    const { guide, items } = await request.json();
    if (!Array.isArray(items) || !items.length || items.length > 16) return NextResponse.json({ error: "Bad kit" }, { status: 400 });
    const clean = items.map((it: { n?: unknown; url?: unknown; w?: unknown; h?: unknown }, i: number) => {
      if (!okUrl(it.url)) throw new Error("Bad image URL");
      return { n: Number(it.n) || i + 1, url: it.url, w: Number(it.w) || 0, h: Number(it.h) || 0 };
    });
    const manifest = await uploadJson({ kind: "mesticker-liene-kit", created: Date.now(), guide: okUrl(guide) ? guide : null, items: clean });
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.json({ url: `${origin}/booth/kit?m=${encodeURIComponent(manifest)}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kit failed" }, { status: 400 });
  }
}
