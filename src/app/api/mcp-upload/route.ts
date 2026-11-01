import { timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import { uploadImage } from "@/lib/storage";

/**
 * Plain file upload for MCP users who have a photo on disk (e.g. Claude Code
 * on the booth laptop):  curl -F file=@me.jpg "https://mesticker.fun/api/mcp-upload?key=…"
 * → { photo_url } to pass to the MCP tools.
 */

export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.MCP_SECRET;
  if (!secret) return false;
  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(key), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return Response.json({ error: "Send the image as form field 'file'" }, { status: 400 });
    const jpeg = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    const url = await uploadImage(`data:image/jpeg;base64,${jpeg.toString("base64")}`);
    return Response.json({ photo_url: url });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}
