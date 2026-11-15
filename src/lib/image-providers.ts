/**
 * Pluggable image providers for the booth, so we can swap to whichever
 * model is fastest without touching the UI.
 *
 *   IMAGE_PROVIDER=openai  (default) — gpt-image via generation.ts, native transparency
 *   IMAGE_PROVIDER=gemini  — Google "Nano Banana 2" (Gemini Flash Image), needs GEMINI_API_KEY
 *   IMAGE_PROVIDER=fal     — FLUX Kontext on fal.ai, needs FAL_KEY
 *
 * Fallback: if the active provider fails (out of credits, rate limited, down,
 * slow), the same request goes to the next provider that has a key, and a
 * failing provider is skipped for a few minutes so guests don't wait on it.
 * Gemini uses GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.
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

const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

function hasKey(p: ImageProvider) {
  if (p === "openai") return !!process.env.OPENAI_API_KEY;
  if (p === "gemini") return !!geminiKey();
  return !!process.env.FAL_KEY;
}

/** Providers that failed recently, skipped until this time (per server instance). */
const downUntil = new Map<ImageProvider, number>();
const SKIP_MS = 3 * 60 * 1000;
export const isDown = (p: ImageProvider) => (downUntil.get(p) ?? 0) > Date.now();

/** Active provider first, then every other one with a key; recently failed ones last. */
export function providerChain(): ImageProvider[] {
  const first = activeProvider();
  const all = [first, ...(["openai", "gemini", "fal"] as ImageProvider[]).filter((p) => p !== first)].filter(hasKey);
  return [...all.filter((p) => !isDown(p)), ...all.filter(isDown)];
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms))]);
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
      "gemini-2.5-flash-image",
      "gemini-2.5-flash-image-preview",
    ].filter((m): m is string => !!m)
  )
);
let workingGeminiModel: string | null = null;

async function generateGemini(image: string, prompt: string) {
  const key = geminiKey();
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
 * Booth tiers. The preview is generated exactly like the main web app
 * (same prompt, quality "medium") so stickers look the same everywhere.
 *   BOOTH_PREVIEW_QUALITY — override the preview quality (e.g. "low" = faster, rougher)
 *   BOOTH_PRINT_QUALITY   — if set (e.g. "high"), a second, sharper copy is made in
 *                           the background for printing; unset = print the preview.
 * Gemini / FLUX have no quality knob, so there is never a separate print copy.
 */
export function hasPrintTier() {
  return activeProvider() === "openai" && !isDown("openai") && !!process.env.BOOTH_PRINT_QUALITY;
}

async function runProvider(provider: ImageProvider, image: string, prompt: string, tier: "preview" | "print") {
  if (provider === "gemini") return generateGemini(image, prompt);
  if (provider === "fal") return generateFal(image, prompt);
  const q = tier === "print" ? quality(process.env.BOOTH_PRINT_QUALITY, "high") : quality(process.env.BOOTH_PREVIEW_QUALITY, "medium");
  return { image: await generateAtQuality(image, prompt, q), model: `${process.env.OPENAI_IMAGE_MODEL || "gpt-image"} (${q})` };
}

/** A refusal for this photo would fail everywhere; anything else is worth another provider. */
const isRefusal = (msg: string) => /safety|moderation|refus|policy/i.test(msg);

export async function generateSticker(image: string, prompt: string, tier: "preview" | "print" = "preview"): Promise<ProviderResult> {
  const chain = providerChain();
  if (!chain.length) throw new Error("No image provider is configured");
  // keep the first try short enough that a backup still fits in the request
  const budget = Number(process.env.BOOTH_PROVIDER_TIMEOUT_MS) || 40000;
  let lastErr: unknown = null;
  for (const [i, provider] of chain.entries()) {
    const t0 = Date.now();
    try {
      const out = await withTimeout(runProvider(provider, image, prompt, tier), i < chain.length - 1 ? budget : 85000, provider);
      downUntil.delete(provider);
      return { ...out, provider, ms: Date.now() - t0 };
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[image-providers] ${provider} failed: ${msg}`);
      if (isRefusal(msg)) break;
      downUntil.set(provider, Date.now() + SKIP_MS);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Image generation failed");
}
