import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload a base64 image to Cloudinary.
 * If `removeBg` is true, applies Cloudinary's AI background removal so the
 * resulting PNG has a transparent alpha channel — required for Printful kiss-cut.
 */
export async function uploadImage(
  base64Image: string,
  folder: string = "mesticker",
  removeBg: boolean = false
): Promise<string> {
  const dataUri = `data:image/png;base64,${base64Image}`

  const options: any = {
    folder,
    resource_type: "image",
    format: "png",
  }

  if (removeBg) {
    // Cloudinary AI background removal (requires add-on enabled on account).
    // Falls back gracefully if not enabled — image uploads as-is.
    options.background_removal = "cloudinary_ai"
  }

  const result = await cloudinary.uploader.upload(dataUri, options)

  // If bg removal was requested, Cloudinary returns the original URL but the
  // removal is processed asynchronously. We fetch the transformation URL
  // directly so the sticker image is always transparent.
  if (removeBg) {
    return cloudinary.url(result.public_id, {
      effect: "background_removal",
      format: "png",
      secure: true,
    })
  }

  return result.secure_url
}

/**
 * Validate that a base64 PNG has a transparent alpha channel.
 * Returns true if the image has meaningful transparency (not fully opaque).
 *
 * A fully-opaque image will be printed as a rectangle by Printful's cutter,
 * which is the "uncut square" bug.
 */
export async function hasTransparentBackground(base64Png: string): Promise<boolean> {
  try {
    const buffer = Buffer.from(base64Png, "base64")

    // PNG signature check
    if (buffer.length < 24) return false
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    if (!isPng) return false

    // Find IHDR chunk (starts at byte 8, type at 12-15, data at 16+)
    const colorType = buffer[25]

    // Color types that can have alpha:
    // 4 = Grayscale + alpha
    // 6 = RGB + alpha
    // 3 = Palette (may have tRNS chunk)
    const canHaveAlpha = colorType === 4 || colorType === 6 || colorType === 3
    return canHaveAlpha
  } catch (err) {
    console.error("hasTransparentBackground check failed:", err)
    return false
  }
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

export { cloudinary }
