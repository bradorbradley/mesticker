import { NextRequest, NextResponse } from "next/server";
import { getPair, getPhoto, markConnected, setLaptop, setPhoto, updatePhone, validCode, type LaptopState } from "@/lib/booth-pair";
import { parseSheets } from "@/lib/booth-config";

/**
 * Booth ↔ phone pairing relay (see src/lib/booth-pair.ts).
 *
 *   GET  ?p=<code>            → { photoAt, connectedAt, laptop, phone }
 *   GET  ?p=<code>&photo=1    → { photo }   (data URL; only when photoAt changed)
 *   POST { p, role: "laptop", state }                     the laptop publishes what it shows
 *   POST { p, role: "phone", hello: true }                phone opened the page
 *   POST { p, role: "phone", photo }                      phone's photo (JPEG data URL)
 *   POST { p, role: "phone", picked, seq }                phone changed the sheets
 *   POST { p, role: "phone", print: true }                free mode: print from the phone
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_PHOTO = 4_000_000; // ~3 MB JPEG as a data URL; phones send ~200 KB (1024² crop)

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("p");
  if (!validCode(code)) return NextResponse.json({ error: "bad code" }, { status: 400 });
  try {
    if (request.nextUrl.searchParams.get("photo")) return NextResponse.json({ photo: await getPhoto(code) });
    const pair = await getPair(code);
    return NextResponse.json(pair ?? { code, photoAt: null, connectedAt: null, laptop: null, phone: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[booth/pair] GET", e);
    return NextResponse.json({ error: "pairing unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const code = body.p;
  if (!validCode(code)) return NextResponse.json({ error: "bad code" }, { status: 400 });
  try {
    if (body.role === "laptop") {
      const s = (body.state ?? {}) as Partial<LaptopState>;
      await setLaptop(code, {
        step: String(s.step ?? ""),
        picked: parseSheets(s.picked),
        sticker: typeof s.sticker === "string" ? s.sticker : null,
        payUrl: typeof s.payUrl === "string" && s.payUrl.startsWith("https://") ? s.payUrl : null,
        payFor: typeof s.payFor === "string" ? s.payFor : null,
        freeMode: !!s.freeMode,
        paid: !!s.paid,
      });
      return NextResponse.json({ ok: true });
    }
    if (body.role === "phone") {
      if (body.hello) await markConnected(code);
      else if (typeof body.photo === "string") {
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(body.photo) || body.photo.length > MAX_PHOTO) {
          return NextResponse.json({ error: "photo must be a JPEG/PNG under 3 MB" }, { status: 400 });
        }
        await setPhoto(code, body.photo);
      } else if (Array.isArray(body.picked)) await updatePhone(code, { picked: parseSheets(body.picked), seq: Number(body.seq) || Date.now() });
      else if (body.print) await updatePhone(code, { print: Date.now() });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "role must be laptop or phone" }, { status: 400 });
  } catch (e) {
    console.error("[booth/pair] POST", e);
    return NextResponse.json({ error: "pairing unavailable" }, { status: 503 });
  }
}
