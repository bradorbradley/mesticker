export async function removeBackground(imageBase64: string): Promise<string> {
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) throw new Error("REMOVEBG_API_KEY is not set");

  // Strip data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const formData = new FormData();
  formData.append(
    "image_file",
    new Blob([Buffer.from(base64Data, "base64")], { type: "image/png" }),
    "image.png"
  );
  formData.append("size", "auto");
  formData.append("format", "png");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`remove.bg API error (${response.status}): ${error}`);
  }

  const buffer = await response.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
}
