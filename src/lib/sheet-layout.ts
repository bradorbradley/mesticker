/**
 * Generates a composite sticker sheet image.
 *
 * Takes a single sticker image and tiles it into a 2×3 grid on an A4 canvas
 * (300 DPI). The result is a print-ready PNG that Printful uses for their
 * Kiss-Cut Sticker Sheet product (product 505).
 *
 * Layout: 6 stickers per sheet, 3" × 3" each, on 8.27" × 11.69" (A4).
 */
import sharp from "sharp";

// A4 at 300 DPI
const SHEET_WIDTH = 2481;
const SHEET_HEIGHT = 3507;

// 3" sticker at 300 DPI
const STICKER_SIZE = 900;

const COLS = 2;
const ROWS = 3;

export async function createSheetImage(stickerBase64: string): Promise<Buffer> {
  // Strip data URL prefix if present
  const raw = stickerBase64.replace(/^data:image\/\w+;base64,/, "");
  const stickerBuffer = Buffer.from(raw, "base64");

  // Resize sticker to target size, preserving transparency
  const resized = await sharp(stickerBuffer)
    .resize(STICKER_SIZE, STICKER_SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Calculate even spacing
  const colGap = Math.floor((SHEET_WIDTH - COLS * STICKER_SIZE) / (COLS + 1));
  const rowGap = Math.floor((SHEET_HEIGHT - ROWS * STICKER_SIZE) / (ROWS + 1));

  // Build composite overlay array
  const composites: sharp.OverlayOptions[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      composites.push({
        input: resized,
        left: colGap + col * (STICKER_SIZE + colGap),
        top: rowGap + row * (STICKER_SIZE + rowGap),
      });
    }
  }

  // Create white A4 canvas and composite stickers onto it
  return sharp({
    create: {
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
