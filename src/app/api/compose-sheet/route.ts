import { NextRequest, NextResponse } from "next/server";
import { composeSheet } from "@/lib/sheet-composer";

export async function POST(request: NextRequest) {
  try {
    const { images, repeat }: { images: string[]; repeat?: number } =
      await request.json();

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }

    // Convert base64 data URLs to Buffers
    const buffers = images.map((img) => {
      const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
      return Buffer.from(base64Data, "base64");
    });

    // If repeat is set and only 1 image, duplicate to fill 6 slots
    let imageBuffers: Buffer[];
    if (repeat && buffers.length === 1) {
      imageBuffers = Array(repeat).fill(buffers[0]);
    } else {
      imageBuffers = buffers;
    }

    // Compose the sheet
    const result = await composeSheet(imageBuffers);

    // Return as base64 data URL
    const composedImage = `data:image/png;base64,${result.buffer.toString("base64")}`;

    return NextResponse.json({ composedImage });
  } catch (error) {
    console.error("Compose sheet error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Sheet composition failed",
      },
      { status: 500 }
    );
  }
}
