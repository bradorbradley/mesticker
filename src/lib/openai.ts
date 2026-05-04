/**
 * Thin re-export shim for backward compatibility.
 * All generation logic has moved to src/lib/generation.ts.
 */
import { generatePreview } from "@/lib/generation";

/** @deprecated Use generatePreview or generatePrint from @/lib/generation */
export async function generateStickerImage(
  imageBase64: string,
  stylePrompt: string
): Promise<string> {
  return generatePreview(imageBase64, stylePrompt);
}
