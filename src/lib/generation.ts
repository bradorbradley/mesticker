/**
 * Image generation — uses OpenAI image-edit API.
 *
 * Model is configurable via OPENAI_IMAGE_MODEL env var.
 * Falls back through current models if the configured one is unavailable.
 *
 * Two tiers:
 *   - generatePreview: low quality, fast, for the interactive flow
 *   - generatePrint:   high quality, for Printful fulfillment after purchase
 *
 * Background handling: requests transparent background where supported,
 * with a remove.bg safety net if the model output is opaque.
 */

import OpenAI, { toFile } from "openai";
import { removeBackground } from "@/lib/removebg";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

// gpt-image-1 has been retired by OpenAI ("The model 'gpt-image-1' does not
// exist"). We try the configured model first, then fall back through current
// models so a stale OPENAI_IMAGE_MODEL env var can't take generation down.
const MODEL_CANDIDATES = Array.from(
  new Set(
    [
      process.env.OPENAI_IMAGE_MODEL,
      "gpt-image-2",
      "gpt-image-1.5",
      "gpt-image-1-mini",
    ].filter((m): m is string => !!m)
  )
);

// Remember the first model that worked so later requests skip dead ones.
let workingModel: string | null = null;

export const COST_PREVIEW = 0.011;
export const COST_PRINT = 0.08;

async function prepareImageFile(imageBase64: string) {
  const match = imageBase64.match(/^data:(image\/[\w+.-]+);base64,/);
  const mime = match?.[1] ?? "image/png";
  const ext = mime.split("/")[1].replace("jpeg", "jpg").replace(/\W.*/, "");
  const base64Data = imageBase64.replace(/^data:image\/[\w+.-]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  return toFile(buffer, `photo.${ext}`, { type: mime });
}

interface EditOpts {
  quality: "low" | "medium" | "high";
}

function isModelUnavailable(err: unknown): boolean {
  const e = err as { param?: string; code?: string; message?: string };
  if (e?.param === "model" || e?.code === "model_not_found") return true;
  return /model .*(does not exist|not found|not available|access)/i.test(
    e?.message ?? ""
  );
}

async function editWithModel(
  model: string,
  imageBase64: string,
  prompt: string,
  opts: EditOpts
) {
  try {
    return await openai.images.edit({
      model,
      image: await prepareImageFile(imageBase64),
      prompt,
      quality: opts.quality,
      size: "1024x1024",
      background: "transparent",
    });
  } catch (err) {
    if (isModelUnavailable(err)) throw err;
    const msg = err instanceof Error ? err.message : "";
    // Some models don't support transparent backgrounds — retry without it
    // (remove.bg below cleans up the background when configured).
    if (/background|param|unsupported|unknown/i.test(msg)) {
      return await openai.images.edit({
        model,
        image: await prepareImageFile(imageBase64),
        prompt,
        quality: opts.quality,
        size: "1024x1024",
      });
    }
    throw err;
  }
}

async function editImage(
  imageBase64: string,
  prompt: string,
  opts: EditOpts
): Promise<string> {
  const models = workingModel
    ? [workingModel, ...MODEL_CANDIDATES.filter((m) => m !== workingModel)]
    : MODEL_CANDIDATES;

  let response;
  let lastErr: unknown;
  for (const model of models) {
    try {
      response = await editWithModel(model, imageBase64, prompt, opts);
      workingModel = model;
      break;
    } catch (err) {
      if (!isModelUnavailable(err)) throw err;
      console.warn(`Image model "${model}" unavailable, trying next`);
      lastErr = err;
    }
  }
  if (!response) throw lastErr ?? new Error("No image model available");

  const outputBase64 = response.data?.[0]?.b64_json;
  if (!outputBase64) {
    throw new Error("No image generated");
  }

  const dataUrl = `data:image/png;base64,${outputBase64}`;

  if (process.env.REMOVEBG_API_KEY) {
    try {
      return await removeBackground(dataUrl);
    } catch {
      return dataUrl;
    }
  }

  return dataUrl;
}

export async function generatePreview(
  imageBase64: string,
  stylePrompt: string
): Promise<string> {
  return editImage(imageBase64, stylePrompt, { quality: "medium" });
}

/**
 * Cheap variation preview — quality:low.
 * Used for the 9-grid tiles. Cost: ~$0.011 per call vs $0.04 for medium.
 * The webhook regenerates user-selected variations at quality:high before
 * sending to Printful, so print quality is preserved.
 */
export async function generateVariationPreview(
  imageBase64: string,
  stylePrompt: string
): Promise<string> {
  return editImage(imageBase64, stylePrompt, { quality: "low" });
}

export async function generatePrint(
  imageBase64: string,
  stylePrompt: string
): Promise<string> {
  return editImage(imageBase64, stylePrompt, { quality: "high" });
}
