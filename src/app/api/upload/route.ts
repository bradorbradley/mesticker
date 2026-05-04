import { NextRequest, NextResponse } from "next/server";
import { uploadImage } from "@/lib/storage";

/**
 * Upload a base64 image to Vercel Blob and return the public URL.
 * Used to upload the generated cartoon ONCE post-generation so that
 * subsequent order POSTs don't have to re-upload it on every cart change.
 */
export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();
    if (!image) {
      return NextResponse.json({ error: "Missing image" }, { status: 400 });
    }
    const url = await uploadImage(image);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
