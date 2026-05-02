/**
 * Image generation module — two tiers:
 *
 * Preview tier (generatePreview): gpt-image-1-5 quality:low
 *   - $0.009/image at 1024x1024
 *   - Fastest OpenAI option, preserves IP style quality (Pixar, Simpsons, etc.)
 *   - Native transparent background — no separate BG removal step
 *   - Target: <10s end-to-end
 *
 * Print tier (generatePrint): gpt-image-1-5 quality:high
 *   - $0.133/image at 1024x1024
 *   - Best quality for 300 DPI physical sticker sheets
 *   - Native transparent background
 *   - Not user-facing latency — runs after purchase
 *
 * Why gpt-image-1-5 over alternatives:
 *   - Flux Kontext ($0.04, 3-6s): faster but needs separate BG removal, less precise
 *     on IP styles (Simpsons yellow, SpongeBob outlines). User tested and confirmed
 *     gpt-image-1 gives best IP style fidelity.
 *   - Gemini Flash ($0.04, 3-8s): tested and rejected — not precise enough for IP styles.
 *   - gpt-image-1-5 low is 20% cheaper than gpt-image-1 low ($0.009 vs $0.011)
 *     and faster (up to 4x improvement per OpenAI docs).
 */

import OpenAI, { toFile } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

/** Cost constants for spend tracking */
export const COST_PREVIEW = 0.009; // gpt-image-1-5 low 1024x1024
export const COST_PRINT = 0.133; // gpt-image-1-5 high 1024x1024

async function prepareImageFile(imageBase64: string) {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  return toFile(buffer, "photo.png", { type: "image/png" });
}

/**
 * Fast preview generation — for the interactive flow.
 * Uses gpt-image-1-5 quality:low for speed + native transparency.
 */
export async function generatePreview(
  imageBase64: string,
  stylePrompt: string
): Promise<string> {
  const imageFile = await prepareImageFile(imageBase64);

  const response = await openai.images.edit({
    model: "gpt-image-1-5",
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
 * Uses gpt-image-1-5 quality:high for 300 DPI print quality.
 */
export async function generatePrint(
  imageBase64: string,
  stylePrompt: string
): Promise<string> {
  const imageFile = await prepareImageFile(imageBase64);

  const response = await openai.images.edit({
    model: "gpt-image-1-5",
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
