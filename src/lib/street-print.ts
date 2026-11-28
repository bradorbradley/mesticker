import { enqueue, finish, markVerified, orderProgress, type QueueItem, type QueueStatus, type QueueStage } from "@/lib/booth-queue";
import { uploadJson } from "@/lib/storage";
import { STREET_SHEET, getOrder, setQueued, type StreetOrder } from "@/lib/street-orders";

/**
 * Street orders print on the booth's print station: once paid, the order goes
 * on booth_queue (same id), with every sticker as its own image and its spot
 * on the sheet, exactly like a booth order. The station laptop claims it,
 * prints and cuts it, and marks it done.
 *
 * Paid (Stripe) orders go on verified. Cash orders go on unverified and
 * print once the seller taps "Got the cash". Free test orders print only on
 * a station run with --include-unverified, like the booth's free mode.
 */

export const STREET_STATION = () => process.env.BOOTH_ID || "booth-1";

/** Card / cash-in-hand: the station prints it without --include-unverified. */
export const printable = (o: Pick<StreetOrder, "payment" | "collected">) => o.payment === "paid" || (o.payment === "cash" && o.collected);

export async function queueStreetOrder(o: StreetOrder, guide: string, items: QueueItem[], origin: string) {
  const manifest = await uploadJson({ kind: "mesticker-liene-kit", created: Date.now(), guide, guides: [guide], items, street: o.code });
  await enqueue({
    id: o.id,
    boothId: STREET_STATION(),
    productId: STREET_SHEET,
    // no checkout id: the booth's own Stripe re-check expects booth checkouts
    checkoutId: null,
    verified: printable(o),
    kitUrl: `${origin}/booth/kit?m=${encodeURIComponent(manifest)}`,
    guideUrl: guide,
    guides: [guide],
    items,
  });
  await setQueued(o.id);
  return (await getOrder(o.id))!;
}

/** Cash in hand, or paid after it was queued: let the station print it. */
export async function releaseToStation(o: StreetOrder) {
  if (o.queuedAt && printable(o)) await markVerified(o.id);
}

export async function reprint(id: string) {
  return finish(id, "requeue");
}

export interface StreetQueue {
  status: QueueStatus;
  stage: QueueStage | null;
  stageAt: string | null;
  verified: boolean;
  ahead: number;
}

/** Where the order is on the print station (null until it's queued). */
export async function streetQueue(o: StreetOrder): Promise<StreetQueue | null> {
  if (!o.queuedAt) return null;
  try {
    const p = await orderProgress(o.id);
    return p ? { status: p.status, stage: p.stage, stageAt: p.stageAt, verified: p.verified, ahead: p.ahead } : null;
  } catch (e) {
    console.error("[street] queue status failed:", e);
    return null;
  }
}
