/**
 * Compose a branded share card from the user's cartoon.
 *
 * Output: 1080x1080 PNG — Instagram square / Twitter image / TikTok
 * cover-friendly. Watermarked with the MeSticker name + URL so when it
 * gets reposted (screenshotted, cropped, whatever), the brand and CTA
 * survive the trip.
 *
 * Pure client-side via Canvas — runs in <50ms.
 */

const CARD_SIZE = 1080;
const PADDING = 60;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export async function composeShareCard(cartoonDataUrl: string): Promise<string> {
  const cartoon = await loadImage(cartoonDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Background — subtle gradient that matches the brand
  const bgGradient = ctx.createLinearGradient(0, 0, CARD_SIZE, CARD_SIZE);
  bgGradient.addColorStop(0, "#F4EFFF");
  bgGradient.addColorStop(1, "#FFE8F1");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

  // Cartoon centered, takes up most of the card
  const imgArea = CARD_SIZE - PADDING * 2;
  const imgAspect = cartoon.width / cartoon.height;
  let drawW = imgArea;
  let drawH = imgArea;
  if (imgAspect > 1) drawH = imgArea / imgAspect;
  else drawW = imgArea * imgAspect;
  // Reserve bottom 140px for branding strip
  const verticalSlot = CARD_SIZE - 140 - PADDING * 2;
  if (drawH > verticalSlot) {
    const scale = verticalSlot / drawH;
    drawH *= scale;
    drawW *= scale;
  }
  const offsetX = (CARD_SIZE - drawW) / 2;
  const offsetY = PADDING + (verticalSlot - drawH) / 2;

  // Soft shadow under the character
  ctx.save();
  ctx.shadowColor = "rgba(124, 92, 252, 0.25)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.drawImage(cartoon, offsetX, offsetY, drawW, drawH);
  ctx.restore();

  // Bottom branding strip
  const stripY = CARD_SIZE - 140;
  ctx.fillStyle = "#7C5CFC";
  ctx.font = "bold 56px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("MeSticker", CARD_SIZE / 2, stripY + 20);

  ctx.fillStyle = "#5C4CC9";
  ctx.font = "500 32px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("Make yours at mesticker.fun", CARD_SIZE / 2, stripY + 80);

  // Tiny corner watermark — survives crops
  ctx.fillStyle = "rgba(124, 92, 252, 0.6)";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("mesticker.fun", CARD_SIZE - 24, CARD_SIZE - 24);

  return canvas.toDataURL("image/png");
}
