/**
 * Save an image to the user's device.
 *
 * On iOS Safari (and any browser that supports navigator.share with files),
 * this opens the system share sheet which lets the user pick "Save Image"
 * or "Save to Photos" — the image lands in their Photos app, not as a
 * file download in Files.
 *
 * Falls back to a regular download for desktop browsers without share-files
 * support (Chrome desktop, Firefox).
 */

import { hapticLight } from "@/lib/haptics";

export async function saveImageToPhotos(
  imageUrl: string,
  filename: string = `mesticker-${Date.now()}.png`
): Promise<{ saved: boolean; method: "share" | "download" | "cancelled" }> {
  hapticLight();

  // Try the Web Share API with a File first — this gives iOS the option
  // to "Save Image" which writes directly to the Photos app.
  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return { saved: true, method: "share" };
        } catch (err) {
          // User cancelled the share sheet
          if (err instanceof Error && err.name === "AbortError") {
            return { saved: false, method: "cancelled" };
          }
          // Other share errors — fall through to download
        }
      }
    } catch {
      // Fetch / blob conversion failed — fall through to download
    }
  }

  // Fallback: trigger a regular download
  try {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { saved: true, method: "download" };
  } catch {
    return { saved: false, method: "cancelled" };
  }
}

/**
 * Save multiple images sequentially. Each one prompts for save (the share
 * sheet appears once per image on iOS). Used for the iPhone sticker pack
 * where a user wants their full set in Photos for use as iMessage stickers.
 */
export async function saveImagesToPhotos(
  images: Array<{ url: string; filename: string }>
): Promise<number> {
  let savedCount = 0;
  for (const img of images) {
    const result = await saveImageToPhotos(img.url, img.filename);
    if (result.saved) savedCount++;
    if (result.method === "cancelled") break; // user bailed
    // Tiny stagger so the share sheet has time to dismiss between iterations
    await new Promise((r) => setTimeout(r, 200));
  }
  return savedCount;
}
