/**
 * Client-side sticker sheet composer.
 *
 * Mirrors the server-side `composeSheet` (sharp) layout exactly:
 *   - Output: PNG, transparent background
 *   - Size:   5.83 × 8.27" at 300 DPI = 1750 × 2480 px
 *   - Layout: 2-column grid for up to 6 stickers, 0.125" margin (38 px)
 *
 * Why client-side: the previous flow fired up to 10 simultaneous calls
 * to /api/compose-sheet (1 Pack + 9 tiles), saturating Vercel serverless
 * and causing the Pack compose to hang silently. Doing it in the browser
 * via Canvas removes the round-trip entirely and runs in <100ms.
 */

const SHEET_WIDTH = 1750;
const SHEET_HEIGHT = 2480;
const MARGIN_PX = 38;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Compose an array of transparent PNG data URLs onto a single sheet.
 * Returns a base64 PNG data URL ready to upload to Vercel Blob → Printful.
 *
 * @param images   Array of image data URLs (or blob URLs) to lay out
 * @param repeat   If set with a single image, duplicate to fill `repeat` slots
 */
export async function composeSheetClient(
  images: string[],
  repeat?: number
): Promise<string> {
  if (!images.length) throw new Error("No images to compose");

  let imgs: string[];
  if (repeat && images.length === 1) {
    imgs = Array(repeat).fill(images[0]);
  } else {
    imgs = images.slice(0, 6);
  }

  const n = imgs.length;
  if (n === 0) throw new Error("No images to compose");
  if (n > 6) throw new Error("Max 6 stickers per sheet");

  const cols = n <= 2 ? n : 2;
  const rows = Math.ceil(n / cols);

  const availW = SHEET_WIDTH - MARGIN_PX * (cols + 1);
  const availH = SHEET_HEIGHT - MARGIN_PX * (rows + 1);

  const cellSize = Math.min(
    Math.floor(availW / cols),
    Math.floor(availH / rows)
  );

  // Center the grid horizontally and vertically within the sheet
  const horizontalPad = Math.floor(
    (availW - cols * cellSize - (cols - 1) * MARGIN_PX) / 2
  );
  const verticalPad = Math.floor(
    (availH - rows * cellSize - (rows - 1) * MARGIN_PX) / 2
  );

  // Canvas — transparent base
  const canvas = document.createElement("canvas");
  canvas.width = SHEET_WIDTH;
  canvas.height = SHEET_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.clearRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

  // Load all images in parallel
  const loaded = await Promise.all(imgs.map(loadImage));

  loaded.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = MARGIN_PX + col * (cellSize + MARGIN_PX) + horizontalPad;
    const cellY = MARGIN_PX + row * (cellSize + MARGIN_PX) + verticalPad;

    // Fit image into cell preserving aspect ratio (contain)
    const imgAspect = img.width / img.height;
    let drawW = cellSize;
    let drawH = cellSize;
    if (imgAspect > 1) {
      drawH = cellSize / imgAspect;
    } else if (imgAspect < 1) {
      drawW = cellSize * imgAspect;
    }
    const offsetX = cellX + (cellSize - drawW) / 2;
    const offsetY = cellY + (cellSize - drawH) / 2;

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  });

  return canvas.toDataURL("image/png");
}
