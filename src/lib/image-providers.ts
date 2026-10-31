/**
 * Pluggable image providers for the booth, so we can swap to whichever
 * model is fastest without touching the UI.
 *
 *   IMAGE_PROVIDER=openai  (default) — gpt-image via generation.ts, native transparency
 *   IMAGE_PROVIDER=gemini  — Google "Nano Banana 2" (Gemini Flash Image), needs GEMINI_API_KEY
 *   IMAGE_PROVIDER=fal     — FLUX Kontext on fal.ai, needs FAL_KEY
 *
 * Gemini and FLUX can't output transparent PNGs, so they're prompted for a
 * pure white background which is then removed (remove.bg if configured,
 * otherwise our own flood-fill cutout).
 */

import { generateAtQuality } from "@/lib/generation";
import { removeBackground } from "@/lib/removebg";
import { cutoutWhiteBackground } from "@/lib/cutout";

export type ImageProvider = "openai" | "gemini" | "fal";

export interface ProviderResult {
  image: string; // data:image/png;base64
  provider: ImageProvider;
  model: string;
  ms: number;
}

export function activeProvider(): ImageProvider {
  const p = (process.env.BOOTH_IMAGE_PROVIDER || process.env.IMAGE_PROVIDER || "openai").toLowerCase();
  return p === "gemini" || p === "fal" ? p : "openai";
}

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[\w+.-]+);base64,(.*)$/);
  return { mime: match?.[1] ?? "image/jpeg", data: match?.[2] ?? dataUrl };
}

/** Non-OpenAI models: ask for white instead of transparent. */
function whiteBackgroundPrompt(prompt: string) {
  return (
    prompt
      .replace(/Isolated subject on fully transparent background\.?/gi, "")
      .replace(/No background,?/gi, "")
      .replace(/transparent background/gi, "plain pure white background") +
    " Place the sticker on a plain, flat, pure white (#FFFFFF) background with nothing else in the frame."
  );
}

async function cleanBackground(dataUrl: string) {
  if (process.env.REMOVEBG_API_KEY) {
    try {
      return await removeBackground(dataUrl);
    } catch {
      /* fall through to local cutout */
    }
  }
  return cutoutWhiteBackground(dataUrl);
}

// ---------------------------------------------------------------- Gemini
// Google's model IDs for Nano Banana 2 vary by release channel; try the
// configured one first, then the known aliases.
const GEMINI_MODELS = Array.from(
  new Set(
    [
      process.env.GEMINI_IMAGE_MODEL,
      "gemini-3.1-flash-image",
      "gemini-3.1-flash-image-preview",
      "gemini-nano-banana-2.1",
    ].filter((m): m is string => !!m)
  )
);
let workingGeminiModel: string | null = null;

async function generateGemini(image: string, prompt: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const { mime, data } = splitDataUrl(image);
  const models = workingGeminiModel
    ? [workingGeminiModel, ...GEMINI_MODELS.filter((m) => m !== workingGeminiModel)]
    : GEMINI_MODELS;

  let lastErr = "No Gemini image model available";
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: whiteBackgroundPrompt(prompt) }, { inline_data: { mime_type: mime, data } }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
        }),
      }
    );
    if (res.status === 404) {
      lastErr = `Gemini model "${model}" not found`;
      continue;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `Gemini error ${res.status}`);
    type Part = { inlineData?: { data: string; mimeType?: string }; inline_data?: { data: string; mime_type?: string } };
    const parts: Part[] = json?.candidates?.[0]?.content?.parts ?? [];
    const part = parts.find((p) => p.inlineData || p.inline_data);
    const b64 = part?.inlineData?.data ?? part?.inline_data?.data;
    if (!b64) throw new Error("Gemini returned no image (it may have refused this photo)");
    const outMime = part?.inlineData?.mimeType ?? part?.inline_data?.mime_type ?? "image/png";
    workingGeminiModel = model;
    return { image: await cleanBackground(`data:${outMime};base64,${b64}`), model };
  }
  throw new Error(lastErr);
}

// ---------------------------------------------------------------- fal.ai FLUX Kontext
async function generateFal(image: string, prompt: string) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  const model = process.env.FAL_MODEL || "fal-ai/flux-pro/kontext";
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify({ prompt: whiteBackgroundPrompt(prompt), image_url: image, output_format: "png" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.detail?.[0]?.msg || json?.detail || `fal error ${res.status}`);
  const url: string | undefined = json?.images?.[0]?.url;
  if (!url) throw new Error("fal returned no image");
  const img = await fetch(url);
  const buf = Buffer.from(await img.arrayBuffer());
  return { image: await cleanBackground(`data:image/png;base64,${buf.toString("base64")}`), model };
}

type Quality = "low" | "medium" | "high";
const quality = (v: string | undefined, fallback: Quality): Quality =>
  v === "low" || v === "medium" || v === "high" ? v : fallback;

/**
 * Booth tiers. OpenAI's quality setting is the big speed lever:
 *   preview — what the guest waits for: "low" (~2-3x faster than medium)
 *   print   — made in the background while they decide/pay: "medium"
 * Gemini / FLUX have no quality knob, so the preview is already the print.
 */
export function hasPrintTier() {
  return activeProvider() === "openai";
}

export async function generateSticker(image: string, prompt: string, tier: "preview" | "print" = "preview"): Promise<ProviderResult> {
  const provider = activeProvider();
  const t0 = Date.now();
  let out: { image: string; model: string };
  if (provider === "gemini") out = await generateGemini(image, prompt);
  else if (provider === "fal") out = await generateFal(image, prompt);
  else {
    const q = tier === "print" ? quality(process.env.BOOTH_PRINT_QUALITY, "medium") : quality(process.env.BOOTH_PREVIEW_QUALITY, "low");
    out = { image: await generateAtQuality(image, prompt, q), model: `${process.env.OPENAI_IMAGE_MODEL || "gpt-image"} (${q})` };
  }
  return { ...out, provider, ms: Date.now() - t0 };
}
