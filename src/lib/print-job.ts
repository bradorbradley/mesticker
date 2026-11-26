/**
 * Queue order → what the PixCut S1 prints: one JPEG and one PLT cut path per sheet.
 *
 * Same builder and checks as the laptop station (hardware/station/pixcut/sheet.mjs),
 * run on the server so a phone or tablet can print without any local software.
 */
import sharp from "sharp";
import type { QueueOrder } from "@/lib/booth-queue";
import { loadImageBuffer } from "@/lib/sheet-render";
import { buildSheet } from "../../hardware/station/pixcut/sheet.mjs";
import { cleanStickerBuffer } from "../../hardware/station/pixcut/clean.mjs";

export interface PrintJob {
  ok: boolean;
  issues: string[];
  warnings: string[];
  /** base64 */
  jpeg?: string;
  plt?: string;
  /** small JPEG data URL: the sheet with its cut lines in pink */
  preview?: string;
  stats?: Record<string, unknown>;
}

export const sheetCount = (order: QueueOrder) => Math.max(order.guides.length, ...order.items.map((it) => (it.sheet ?? 0) + 1), 1);

/** Build sheet `index` (0-based) of an order. `light` = smaller image for Bluetooth. */
export async function buildPrintJob(order: QueueOrder, index: number, light: boolean): Promise<PrintJob> {
  const items = order.items.filter((it) => (it.sheet ?? 0) === index).sort((a, b) => a.n - b.n);
  if (!items.length) return { ok: false, issues: [`order has no sheet ${index + 1}`], warnings: [] };

  const cleaned = new Map<string, Buffer>();
  await Promise.all(
    [...new Set(items.map((it) => it.url))].map(async (url) => {
      const { png } = await cleanStickerBuffer(await loadImageBuffer(url));
      cleaned.set(url, png);
    })
  );
  const placements = items.map((it) => ({ n: it.n, file: cleaned.get(it.url), x: it.x ?? null, y: it.y ?? null, w: it.w, h: it.h }));
  const design = order.productId.split("+")[index] ?? null;
  const built = await buildSheet({ sheet: index + 1, design, placements }, { light, needGuide: false });
  const { qc } = built;
  if (!built.jpeg || !built.plt || !built.preview) return { ok: false, issues: qc.issues, warnings: qc.warnings };
  const preview = await sharp(built.preview).resize({ width: 480 }).jpeg({ quality: 78 }).toBuffer();
  return {
    ok: qc.ok,
    issues: qc.issues,
    warnings: qc.warnings,
    jpeg: built.jpeg.toString("base64"),
    plt: built.plt.toString("base64"),
    preview: `data:image/jpeg;base64,${preview.toString("base64")}`,
    stats: qc.stats,
  };
}
