import { timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import sharp from "sharp";
import { stylePresets, resolvePresetPrompt } from "@/lib/presets";
import { generateAtQuality } from "@/lib/generation";
import { activeProvider, generateSticker } from "@/lib/image-providers";
import { generateVariationDescriptors } from "@/lib/vision";
import { moderatePrompt } from "@/lib/moderation";
import { uploadImage } from "@/lib/storage";
import { recordGeneration } from "@/lib/spend-tracker";
import { DPI, LAYOUT_INFO, LAYOUTS, MIN_GAP_PX, SHEET_H, SHEET_W, type LayoutId, type Slot } from "@/lib/sheet-layouts";
import { borderSticker, loadImageBuffer, renderSheet, toDataUrl } from "@/lib/sheet-render";

/**
 * MeSticker MCP server: lets an AI agent (e.g. Claude on the booth laptop)
 * art-direct sticker sheets with the app's own pipeline: make stickers from a
 * photo in any style/pose, get poses designed for that person, and lay them
 * out into print-ready PixCut S1 sheets, looking at previews as it goes.
 *
 * Auth: set MCP_SECRET; clients send it as `Authorization: Bearer …` or `?key=…`.
 */

export const maxDuration = 300;

// tinted background, so the white die-cut border shows in previews
const imagePreview = async (png: Buffer, size = 512) => ({
  type: "image" as const,
  mimeType: "image/jpeg",
  data: (await sharp(png).flatten({ background: "#cdc4e8" }).resize(size, size, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer()).toString("base64"),
});
const text = (value: unknown) => ({ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) });
const fail = (message: string) => ({ isError: true, content: [text(message)] });

const STYLE_IDS = stylePresets.filter((p) => p.id !== "custom").map((p) => p.id) as [string, ...string[]];
const LAYOUT_IDS = Object.keys(LAYOUTS) as [LayoutId, ...LayoutId[]];
const inches = (px: number) => Math.round((px / DPI) * 100) / 100;

const GUIDE = {
  printer: {
    model: "Liene PixCut S1 (dye-sub print + automatic contour cut)",
    sheet: `4×7" paper, printable area 3.9×6.7" = ${SHEET_W}×${SHEET_H}px at ${DPI} DPI (portrait)`,
    cut_gap: `keep ≥${MIN_GAP_PX}px (~2.5mm) of paper between stickers; compose_sheet checks this for you`,
    smallest_sticker: 'about 0.8" across; below that faces get hard to read',
    cost: "~$0.60 of paper+ribbon per sheet",
  },
  styles: stylePresets.filter((p) => p.id !== "custom").map((p) => ({ id: p.id, name: p.name, description: p.description })),
  layouts: Object.fromEntries(
    LAYOUT_IDS.map((id) => [id, { about: LAYOUT_INFO[id], slots: LAYOUTS[id].map(([x, y, w, h, r]) => ({ x: inches(x), y: inches(y), w: inches(w), h: inches(h), rotate: r })) }])
  ),
  workflow: [
    "1. upload_photo (or pass any https image URL) to get a photo_url.",
    "2. create_sticker with a style_id (or a custom_style description) and optionally a pose. Look at the preview it returns.",
    "3. suggest_poses for ideas designed around this person; make more stickers mixing poses and styles.",
    "4. compose_sheet with the sticker URLs and a layout (or your own slots in inches). Check the preview and any problems, fix, re-compose.",
    "5. Hand the sheet_url PNG to the Liene app: open it, 4×7 sticker paper, Print & Cut.",
  ],
  tips: [
    "Variety makes a sheet feel premium: mix one hero sticker with smaller ones, different poses AND styles, and different shapes (tall, wide, round).",
    "Strong silhouettes cut and read best at small sizes: big expressions, clear gestures, simple props.",
    "quality 'high' gives the most detail for the hero sticker; 'medium' matches the web app; 'low' is fastest for quick drafts.",
    "Each create_sticker call is one AI image (~4¢ medium, ~17¢ high). Draft at low, finalize at medium/high.",
  ],
};

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "mesticker_guide",
      {
        title: "MeSticker guide",
        description: "Read first. Printer specs, available cartoon styles, sheet layouts (slots in inches), the workflow and tips for making great sticker sheets.",
        inputSchema: z.object({}),
      },
      async () => ({ content: [text(GUIDE)] })
    );

    server.registerTool(
      "upload_photo",
      {
        title: "Upload a photo",
        description: "Upload a person's photo (base64 or data URL) and get back a photo_url to use with the other tools.",
        inputSchema: z.object({ image_base64: z.string().min(100).describe("Base64 image data or a data: URL (JPEG/PNG)") }),
      },
      async ({ image_base64 }) => {
        try {
          const raw = image_base64.startsWith("data:") ? image_base64.replace(/^data:[^;]+;base64,/, "") : image_base64;
          const jpeg = await sharp(Buffer.from(raw, "base64")).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
          const url = await uploadImage(toDataUrl(jpeg, "image/jpeg"));
          return { content: [text({ photo_url: url }), await imagePreview(jpeg, 256)] };
        } catch (e) {
          return fail(`Upload failed: ${e instanceof Error ? e.message : e}`);
        }
      }
    );

    server.registerTool(
      "create_sticker",
      {
        title: "Create a sticker",
        description:
          "Turn the person in a photo into one transparent-background cartoon sticker, using the app's own style prompts. Pick a style_id from the guide, or describe a custom_style. Optionally give a pose/expression. Returns the sticker_url and a preview to inspect.",
        inputSchema: z.object({
          photo_url: z.string().describe("https URL (from upload_photo) or data: URL of the person's photo"),
          style_id: z.enum(STYLE_IDS).optional().describe("One of the guide's style ids ('random' picks one)"),
          custom_style: z.string().max(400).optional().describe("Describe any other style instead of style_id"),
          pose: z.string().max(300).optional().describe("Pose / expression / prop for this sticker, e.g. 'thumbs up with a wink'"),
          quality: z.enum(["low", "medium", "high"]).default("medium"),
        }),
      },
      async ({ photo_url, style_id, custom_style, pose, quality }) => {
        try {
          let prompt: string;
          let styleUsed: string;
          if (custom_style) {
            const mod = await moderatePrompt(custom_style);
            if (!mod.allowed) return fail("That custom style was rejected by the content filter.");
            prompt = `${custom_style}. Sticker-ready with a clean outline edge and transparent background. Keep the person's face fully recognizable.`;
            styleUsed = "custom";
          } else {
            const resolved = resolvePresetPrompt(style_id ?? "random");
            prompt = resolved.prompt;
            styleUsed = resolved.resolvedId;
          }
          if (pose) prompt += ` Pose and expression for this sticker: ${pose}. Same person, same hairstyle and outfit, fully recognizable. No text, captions or letters anywhere.`;

          const photo = toDataUrl(await loadImageBuffer(photo_url), "image/jpeg");
          const t0 = Date.now();
          const image = activeProvider() === "openai" ? await generateAtQuality(photo, prompt, quality) : (await generateSticker(photo, prompt)).image;
          recordGeneration(quality === "high" ? "print" : "preview");
          const png = await loadImageBuffer(image);
          const url = await uploadImage(toDataUrl(png));
          return {
            content: [text({ sticker_url: url, style: styleUsed, pose: pose ?? null, quality, seconds: Math.round((Date.now() - t0) / 1000) }), await imagePreview(png)],
          };
        } catch (e) {
          return fail(`Sticker failed: ${e instanceof Error ? e.message : e}`);
        }
      }
    );

    server.registerTool(
      "suggest_poses",
      {
        title: "Suggest poses for this person",
        description: "Look at the photo and design sticker pose/expression ideas specific to this person (the web app's variations engine). Feed them to create_sticker's pose.",
        inputSchema: z.object({ photo_url: z.string() }),
      },
      async ({ photo_url }) => {
        try {
          const photo = toDataUrl(await loadImageBuffer(photo_url), "image/jpeg");
          const { descriptors, source } = await generateVariationDescriptors(photo);
          return { content: [text({ poses: descriptors, source })] };
        } catch (e) {
          return fail(`Couldn't suggest poses: ${e instanceof Error ? e.message : e}`);
        }
      }
    );

    server.registerTool(
      "compose_sheet",
      {
        title: "Compose a print-ready sheet",
        description:
          "Lay stickers out on one 3.9×6.7\" PixCut sheet: each is trimmed to its own shape and given a white die-cut border. Use a named layout or your own slots (inches). Stickers fill slots in order and repeat if there are fewer stickers than slots. Returns the print PNG URL, a preview, and any spacing problems to fix.",
        inputSchema: z.object({
          sticker_urls: z.array(z.string()).min(1).max(16),
          layout: z.enum([...LAYOUT_IDS, "custom"]).default("hero5"),
          slots: z
            .array(z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), rotate: z.number().min(-30).max(30).default(0) }))
            .max(16)
            .optional()
            .describe('For layout "custom": boxes in inches on the 3.9×6.7" sheet; each sticker is fitted inside its box'),
          border: z.enum(["thin", "normal", "thick"]).default("normal"),
        }),
      },
      async ({ sticker_urls, layout, slots, border }) => {
        try {
          let chosen: LayoutId | Slot[];
          if (layout === "custom") {
            if (!slots?.length) return fail('layout "custom" needs slots');
            chosen = slots.map((s) => [s.x * DPI, s.y * DPI, s.w * DPI, s.h * DPI, s.rotate] as Slot);
          } else chosen = layout;

          const unique = Array.from(new Set(sticker_urls));
          const borderedByUrl = new Map(
            await Promise.all(unique.map(async (u) => [u, await borderSticker(await loadImageBuffer(u), border)] as const))
          );
          const { png, problems } = await renderSheet(
            sticker_urls.map((u) => borderedByUrl.get(u)!),
            chosen
          );
          const url = await uploadImage(toDataUrl(png));
          return {
            content: [
              text({
                sheet_url: url,
                layout,
                size: `${SHEET_W}×${SHEET_H}px @ ${DPI} DPI (3.9×6.7")`,
                problems: problems.length ? problems : "none: every sticker has room for the cutter",
                print: "Open in the Liene app → 4×7 sticker paper → Print & Cut",
              }),
              await imagePreview(png, 700),
            ],
          };
        } catch (e) {
          return fail(`Sheet failed: ${e instanceof Error ? e.message : e}`);
        }
      }
    );
  },
  { serverInfo: { name: "mesticker", version: "1.0.0" } }
);

function authorized(req: Request) {
  const secret = process.env.MCP_SECRET;
  if (!secret) return false;
  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(key), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function guarded(req: Request) {
  if (!process.env.MCP_SECRET) return new Response("MeSticker MCP is off: set MCP_SECRET in the environment.", { status: 503 });
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
