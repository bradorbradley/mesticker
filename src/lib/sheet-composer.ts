/**
 * Compose multiple sticker images onto a single kiss-cut sheet.
 *
 * Output: PNG, transparent background
 * Size:   5.83 × 8.27" at 300 DPI = 1750 × 2480 px
 * Layout: Grid with 0.125" margin (38px at 300 DPI)
 *
 * Printful variant 12917 = kiss-cut sticker sheet at this size.
 */

import sharp from "sharp";

const SHEET_WIDTH = 1750;
const SHEET_HEIGHT = 2480;
const MARGIN_PX = 38; // 0.125" at 300 DPI
const MAX_ALPHA_IN_MARGIN = 5;

interface ComposeResult {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Compose an array of transparent PNG images onto a single sheet.
 * Images are arranged in a grid layout (2 columns for up to 6 stickers).
 */
export async function composeSheet(
  imageBuffers: Buffer[],
  count?: number
): Promise<ComposeResult> {
  const n = count || imageBuffers.length;
  if (n === 0) throw new Error("No images to compose");
  if (n > 6) throw new Error("Max 6 stickers per sheet");

  // Calculate grid layout
  const cols = n <= 2 ? n : 2;
  const rows = Math.ceil(n / cols);

  // Available area after margins
  const availW = SHEET_WIDTH - MARGIN_PX * (cols + 1);
  const availH = SHEET_HEIGHT - MARGIN_PX * (rows + 1);

  const cellW = Math.floor(availW / cols);
  const cellH = Math.floor(availH / rows);
  const cellSize = Math.min(cellW, cellH); // square cells

  // Resize all images to fit in cells
  const resized = await Promise.all(
    imageBuffers.slice(0, n).map((buf) =>
      sharp(buf)
        .resize(cellSize, cellSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );

  // Build composite operations
  const composites = resized.map((buf, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN_PX + col * (cellSize + MARGIN_PX) + Math.floor((availW - cols * cellSize - (cols - 1) * MARGIN_PX) / 2);
    const y = MARGIN_PX + row * (cellSize + MARGIN_PX) + Math.floor((availH - rows * cellSize - (rows - 1) * MARGIN_PX) / 2);
    return { input: buf, left: x, top: y };
  });

  // Create transparent base and composite stickers
  const sheet = await sharp({
    create: {
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return {
    buffer: sheet,
    width: SHEET_WIDTH,
    height: SHEET_HEIGHT,
  };
}

/**
 * Validate that margins between stickers are transparent.
 * Returns true if all margin pixels have alpha < MAX_ALPHA_IN_MARGIN.
 */
export async function validateSheetTransparency(
  sheetBuffer: Buffer
): Promise<{ valid: boolean; failedPixels: number }> {
  const { data, info } = await sharp(sheetBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels < 4) return { valid: false, failedPixels: -1 };

  let failedPixels = 0;

  // Check edge pixels (all 4 borders, 2px deep)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isEdge = x < 2 || x >= width - 2 || y < 2 || y >= height - 2;
      if (isEdge) {
        const alpha = data[(y * width + x) * channels + 3];
        if (alpha > MAX_ALPHA_IN_MARGIN) failedPixels++;
      }
    }
  }

  // Check corner samples (10x10 blocks)
  const corners = [
    [0, 0],
    [width - 10, 0],
    [0, height - 10],
    [width - 10, height - 10],
  ];
  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < 10; dy++) {
      for (let dx = 0; dx < 10; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const alpha = data[(y * width + x) * channels + 3];
          if (alpha > MAX_ALPHA_IN_MARGIN) failedPixels++;
        }
      }
    }
  }

  return { valid: failedPixels === 0, failedPixels };
}
