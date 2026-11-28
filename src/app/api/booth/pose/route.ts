import { NextRequest, NextResponse } from "next/server";
import { boothPresets, LIKENESS_DETAILS, resolvePresetPrompt, withEventTheme } from "@/lib/presets";
import { countPeople, generateVariationDescriptors } from "@/lib/vision";
import { generateGroupSticker, generateSticker, requestedGeminiModel, requestedProvider } from "@/lib/image-providers";
import { loadImageBuffer, toDataUrl } from "@/lib/sheet-render";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { recordGeneration, isThrottled } from "@/lib/spend-tracker";

/**
 * Pose / Mix packs. Both start from the ORIGINAL photo, so they can run in
 * parallel with the main sticker instead of waiting for it.
 *   POST { photo }                  → { ideas: string[9] } poses designed for this person
 *                                     (the web app's variations engine)
 *   POST { photo, styleId, idea }   → { image } one sticker: that style, that pose
 * One request per sticker keeps each response small and lets the booth show
 * them as they arrive.
 */

export const maxDuration = 90;

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`booth-pose:${getClientIP(request)}`, 600, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Booth is cooling down" }, { status: 429 });
  if (isThrottled()) return NextResponse.json({ error: "Busy, try again in a minute" }, { status: 503 });

  try {
    const { photo, styleId, idea, provider: wanted, theme, refs, people: rawPeople, count } = await request.json();
    if (!photo) return NextResponse.json({ error: "Missing photo" }, { status: 400 });
    if (count) return NextResponse.json({ people: await countPeople(photo) });
    // a photo of 2+ people: every sticker draws all of them
    const people = Math.max(1, Math.min(6, Number(rawPeople) || 1));
    const crowd = people > 1 ? ` There are ${people} people in the photo: draw ALL ${people} of them together in this sticker, each one recognizable, side by side.` : "";

    if (!idea) {
      const { descriptors } = await generateVariationDescriptors(photo);
      return NextResponse.json({ ideas: descriptors.slice(0, 9) });
    }
    if (!boothPresets.some((p) => p.id === styleId && p.id !== "custom" && p.id !== "random")) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 });
    }
    const prompt = withEventTheme(resolvePresetPrompt(styleId).prompt, theme) + LIKENESS_DETAILS;
    const pose = String(idea).slice(0, 300);
    // a group sticker: the guest plus other characters (our own images only, e.g. the event's hosts)
    if (Array.isArray(refs) && refs.length) {
      const own = refs.filter((r: unknown): r is string => typeof r === "string" && /^\/(events|booth)\/[\w./-]+\.(webp|png|jpg)$/.test(r)).slice(0, 4);
      const origin = request.nextUrl.origin;
      const refImgs = await Promise.all(own.map(async (r: string) => toDataUrl(await loadImageBuffer(origin + r), r.endsWith(".png") ? "image/png" : r.endsWith(".jpg") ? "image/jpeg" : "image/webp")));
      const t0 = Date.now();
      const image = await generateGroupSticker(
        photo,
        refImgs,
        `${prompt} The first image is the guest${people > 1 ? `s (${people} people, include every one of them)` : ""}; the other images are characters who must appear exactly as drawn (same faces, hair and outfits). ${pose}. Draw them all together as ONE cute chibi sticker in the same art style, every face fully recognizable. No text, captions or letters anywhere.`
      );
      recordGeneration("preview");
      return NextResponse.json({ image, ms: Date.now() - t0, provider: "openai", model: "group" });
    }
    const result = await generateSticker(
      photo,
      `${prompt} Pose and expression for this sticker: ${pose}. ${people > 1 ? "The same people" : "Same person"}, same hairstyle and outfit, fully recognizable.${crowd} No text, captions or letters anywhere.`,
      "extra", // small sheet stickers: faster tier (see extrasProvider)
      requestedProvider(wanted),
      requestedGeminiModel(wanted)
    );
    recordGeneration("preview");
    return NextResponse.json({ image: result.image, ms: result.ms, provider: result.provider, model: result.model });
  } catch (error) {
    console.error("[booth/pose]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pose failed" }, { status: 500 });
  }
}
