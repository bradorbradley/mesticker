/**
 * Previews only: ?model=openai or ?model=gemini picks the image model for
 * this visit, so both can be compared on the same preview link. The server
 * ignores it in production.
 */
export function modelOverride(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("model");
    if (fromUrl) sessionStorage.setItem("mesticker:model", fromUrl);
    return fromUrl || sessionStorage.getItem("mesticker:model") || undefined;
  } catch {
    return undefined;
  }
}
