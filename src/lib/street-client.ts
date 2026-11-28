/**
 * Browser helpers for street mode, shared by the guest's phone (/street) and
 * the seller's phone (/street/print).
 */
import { addStickerBorder, composePrintSheet, slotPlacement, trimmedAspect } from "@/lib/booth-print";
import { BOOTH_STYLE } from "@/lib/booth-config";

export const STREET_POSES = 7;

/**
 * Images we store live at <host>/api/images/<id>. Load them from this site's
 * own origin, so canvases aren't tainted and a preview reads its own database.
 */
export function localImage(url: string) {
  try {
    const u = new URL(url, typeof location !== "undefined" ? location.href : "https://mesticker.fun");
    return u.pathname.startsWith("/api/images/") ? u.pathname : url;
  } catch {
    return url;
  }
}

export async function uploadImage(dataUrl: string): Promise<string> {
  const r = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.url) throw new Error(d.error || "Upload failed");
  return d.url as string;
}

export async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(localImage(url))).blob();
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.onerror = no;
    fr.readAsDataURL(blob);
  });
}

const post = (path: string, body: object) =>
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || String(r.status));
    return d;
  });

const retry = <T,>(fn: () => Promise<T>) => fn().catch(() => new Promise<T>((ok, no) => setTimeout(() => fn().then(ok, no), 3000)));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The main sticker from a selfie (same prompt and model as the booth). */
export async function makeMainSticker(photo: string): Promise<string> {
  const d = await post("/api/booth/generate", { image: photo, styleId: BOOTH_STYLE });
  return d.generatedImage as string;
}

/** Pose ideas designed for this person (the booth's vision engine). */
export async function makeIdeas(photo: string): Promise<string[]> {
  const d = await retry(() => post("/api/booth/pose", { photo }));
  return (d.ideas as string[]) ?? [];
}

/**
 * Make the pose stickers for the given slots, in parallel (staggered), one
 * retry each. `onPose(i, image | false)` fires as each one lands.
 */
export function makePoses(photo: string, ideas: string[], slots: number[], onPose: (i: number, image: string | false) => void) {
  return Promise.allSettled(
    slots.map((i, k) =>
      wait(k * 350)
        .then(() => retry(() => post("/api/booth/pose", { photo, styleId: BOOTH_STYLE, idea: ideas[i % Math.max(1, ideas.length)] || "a fun, happy pose" })))
        .then((d) => onPose(i, d.image as string))
        .catch(() => onPose(i, false))
    )
  );
}

/** Pose Party: hero + 7 poses, then the small last row repeats favourites (same as the booth). */
const RECIPE: (number | "main")[] = ["main", 0, 1, 2, 3, 4, 5, 6, "main", 0, 3, 5];

/**
 * The print file: 1170×2010 px (3.9×6.7" at 300 DPI, the PixCut S1's
 * printable area), transparent, every sticker with a white die-cut border so
 * the Liene app can cut around each one. Missing poses print as the main sticker.
 */
export async function buildStreetSheet(main: string, poses: (string | null)[]): Promise<string> {
  const srcs = RECIPE.map((s) => (s === "main" ? main : poses[s] || main)).map(localImage);
  const unique = Array.from(new Set(srcs));
  const borderedOf = new Map(await Promise.all(unique.map(async (s) => [s, await addStickerBorder(s)] as const)));
  return composePrintSheet(srcs.map((s) => borderedOf.get(s)!), "pack12");
}

/**
 * Make any poses still missing (the guest's tab stops making them when it
 * leaves for Stripe), saving each one to the order as it lands. Resolves
 * once every slot has a sticker or has failed.
 */
export async function healPoses(
  order: { photoUrl: string | null; poses: (string | null)[]; ideas: string[] },
  save: (i: number, url: string) => Promise<unknown>,
  onPose?: (i: number, url: string | false) => void
) {
  const missing = order.poses.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
  if (!missing.length || !order.photoUrl) return;
  const photo = await toDataUrl(order.photoUrl);
  const ideas = order.ideas.length ? order.ideas : await makeIdeas(photo);
  await makePoses(photo, ideas, missing, async (i, img) => {
    if (!img) return onPose?.(i, false);
    try {
      const url = await uploadImage(img);
      onPose?.(i, url);
      await save(i, url);
    } catch {
      onPose?.(i, false);
    }
  });
}

/**
 * The print station's kit, same as a booth order: each sticker uploaded once
 * as its own transparent image with a white die-cut border, its spot on the
 * 3.9×6.7" sheet in inches, and a numbered guide of the whole sheet.
 * Missing poses print as the main sticker.
 */
export async function buildStreetKit(mainUrl: string, poses: (string | null)[]) {
  const srcs = RECIPE.map((s) => (s === "main" ? mainUrl : poses[s] || mainUrl)).map(localImage);
  const unique = Array.from(new Set(srcs));
  const done = await Promise.all(
    unique.map(async (s) => {
      const bordered = await addStickerBorder(s);
      const [url, aspect] = await Promise.all([uploadImage(bordered), trimmedAspect(bordered)]);
      return [s, { bordered, url, aspect }] as const;
    })
  );
  const of = new Map(done);
  const items = srcs.map((s, i) => ({ n: i + 1, url: of.get(s)!.url, ...slotPlacement("pack12", i, of.get(s)!.aspect) }));
  const guide = await uploadImage(await composePrintSheet(srcs.map((s) => of.get(s)!.bordered), "pack12", { numbers: true }));
  return { guide, items, files: done.map(([, v]) => v.bordered) };
}

/** Each sticker once, bordered, as files for the share sheet (the no-laptop fallback). */
export async function stickerFiles(mainUrl: string, poses: (string | null)[], code: string) {
  const unique = Array.from(new Set(RECIPE.map((s) => (s === "main" ? mainUrl : poses[s] || mainUrl)).map(localImage)));
  const bordered = await Promise.all(unique.map((s) => addStickerBorder(s)));
  return bordered.map((d, i) => dataUrlToFile(d, `mesticker-${code}-${i + 1}.png`));
}

/** Build the kit and put the order on the print station's queue. */
export async function sendToStation(id: string, mainUrl: string, poses: (string | null)[]) {
  const kit = await buildStreetKit(mainUrl, poses);
  await post("/api/street/kit", { id, guide: kit.guide, items: kit.items });
  return kit;
}

export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(",");
  const type = head.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}

/** Short code the guest shows the seller: letter + digit, no look-alikes. */
export function newCode() {
  const L = "ABCDEFGHJKMNPQRSTUVWXYZ", D = "23456789";
  return L[Math.floor(Math.random() * L.length)] + D[Math.floor(Math.random() * D.length)];
}

export const newOrderId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
