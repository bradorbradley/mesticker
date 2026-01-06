import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function uploadImage(
  base64Image: string,
  folder: string = "mesticker"
): Promise<string> {
  const dataUri = `data:image/png;base64,${base64Image}`

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
    format: "png",
    transformation: [
      { quality: "auto:best" },
      { fetch_format: "png" },
    ],
  })

  return result.secure_url
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

export { cloudinary }
