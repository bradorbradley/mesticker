/**
 * Image generation module — two tiers using gpt-image-2:
 *
 * Preview tier (generatePreview): gpt-image-2 quality:low
 *   - Fast, preserves IP style quality (Pixar, Simpsons, etc.)
 *   - Native transparent background — no separate BG removal step
 *
 * Print tier (generatePrint): gpt-image-2 quality:high
 *   - Best quality for 300 DPI physical sticker sheets
 *   - Native transparent background
 *   - Not user-facing latency — runs after purchase
 */

import OpenAI, { toFile } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

/** Cost constants for spend tracking (estimates) */
export const COST_PREVIEW = 0.011; // gpt-image-2 low 1024x1024
export const COST_PRINT = 0.08; // gpt-image-2 high 1024x1024

async function prepareImageFile(imageBase64: string) {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  return toFile(buffer, "photo.png", { type: "image/png" });
}

/**
 * Fast preview generation — for the interactive flow.
 * Uses gpt-image-2 quality:low for speed + native transparency.
 */
export async function generatePreview(
  imageBase64: string,
  stylePrompt: string
): Promise<string> {
  const imageFile = await prepareImageFile(imageBase64);

  const response = await openai.images.edit({
    model: "gpt-image-2",
    image: imageFile,
    prompt: stylePrompt,
    quality: "low",
    background: "transparent",
    size: "1024x1024",
  });

  const outputBase64 = response.data?.[0]?.b64_json;
  if (!outputBase64) {
    throw new Error("No image generated");
  }

  return `data:image/png;base64,${outputBase64}`;
}

/**
 * High-quality print generation — for Printful fulfillment.
 * Uses gpt-image-2 quality:high for 300 DPI print quality.
 */
export async function generatePrint(
  imageBase64: string,
  stylePrompt: string
): Promise<string> {
  const imageFile = await prepareImageFile(imageBase64);

  const response = await openai.images.edit({
    model: "gpt-image-2",
    image: imageFile,
    prompt: stylePrompt,
    quality: "high",
    background: "transparent",
    size: "1024x1024",
  });

  const outputBase64 = response.data?.[0]?.b64_json;
  if (!outputBase64) {
    throw new Error("No image generated");
  }

  return `data:image/png;base64,${outputBase64}`;
}
