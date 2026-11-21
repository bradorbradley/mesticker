import { NextResponse } from "next/server";
import { activeProvider, extrasProvider, hasKey } from "@/lib/image-providers";

/**
 * Which image models this deployment can use (keys present: yes/no, never
 * the keys) and the defaults from env, for the booth's staff panel switch.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      keys: { openai: hasKey("openai"), gemini: hasKey("gemini"), fal: hasKey("fal") },
      defaults: { hero: activeProvider(), extras: extrasProvider() },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
