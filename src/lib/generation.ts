/**
 * Image generation — uses OpenAI image-edit API.
 *
 * Model is configurable via OPENAI_IMAGE_MODEL env var.
 * Defaults to gpt-image-1 (known stable). Set to gpt-image-2 for the newer model.
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

const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

export const COST_PREVIEW = 0.011;
export const COST_PRINT = 0.08;

async function prepareImageFile(imageBase64: string) {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  return toFile(buffer, "photo.png", { type: "image/png" });
}

interface EditOpts {
  quality: "low" | "medium" | "high";
}

async function editImage(
  imageBase64: string,
  prompt: string,
  opts: EditOpts
): Promise<string> {
  let response;
  try {
    response = await openai.images.edit({
      model: MODEL,
      image: await prepareImageFile(imageBase64),
      prompt,
      quality: opts.quality,
      size: "1024x1024",
      background: "transparent",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/background|param|unsupported|unknown/i.test(msg)) {
      response = await openai.images.edit({
        model: MODEL,
        image: await prepareImageFile(imageBase64),
        prompt,
        quality: opts.quality,
        size: "1024x1024",
      });
    } else {
      throw err;
    }
  }

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

export async function generatePrint(
  imageBase64: string,
  stylePrompt: string
): Promise<string> {
  return editImage(imageBase64, stylePrompt, { quality: "high" });
}
