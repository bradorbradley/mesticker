/**
 * Google Veo (video) and Gemini TTS (voice) via the Gemini API, used by the MCP
 * tools for marketing videos. Veo runs as a long operation: start, then poll.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const key = () =>
  process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "";

async function call(path: string, init?: RequestInit) {
  const k = key();
  if (!k) throw new Error("No Gemini API key configured");
  const res = await fetch(`${BASE}/${path}`, { ...init, headers: { "content-type": "application/json", "x-goog-api-key": k, ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

export const VEO_MODEL = /^veo-[\w.-]{3,60}$/;

/** Start a Veo clip from a first-frame image. Returns the operation name to poll. */
export async function startVideo(opts: { prompt: string; image?: { base64: string; mimeType: string }; model: string; aspectRatio: string; seconds: number; resolution?: string }) {
  if (!VEO_MODEL.test(opts.model)) throw new Error("Unknown Veo model");
  const instance: Record<string, unknown> = { prompt: opts.prompt };
  if (opts.image) instance.image = { bytesBase64Encoded: opts.image.base64, mimeType: opts.image.mimeType };
  const parameters: Record<string, unknown> = { aspectRatio: opts.aspectRatio, durationSeconds: opts.seconds };
  if (opts.resolution) parameters.resolution = opts.resolution;
  const data = await call(`models/${opts.model}:predictLongRunning`, { method: "POST", body: JSON.stringify({ instances: [instance], parameters }) });
  return data.name as string;
}

/** Poll a Veo operation. When done, returns the MP4 bytes. */
export async function pollVideo(operation: string): Promise<{ done: false } | { done: true; mp4: Buffer }> {
  if (!/^models\/veo-[\w.-]+\/operations\/[\w-]+$/.test(operation)) throw new Error("Bad operation name");
  const op = await call(operation);
  if (!op.done) return { done: false };
  if (op.error) throw new Error(`Veo failed: ${JSON.stringify(op.error).slice(0, 400)}`);
  const resp = op.response?.generateVideoResponse;
  const uri = resp?.generatedSamples?.[0]?.video?.uri as string | undefined;
  if (!uri) throw new Error(`Veo returned no video${resp?.raiMediaFilteredReasons ? `: ${resp.raiMediaFilteredReasons.join("; ")}` : ""}`);
  const res = await fetch(uri, { headers: { "x-goog-api-key": key() }, redirect: "follow" });
  if (!res.ok) throw new Error(`Video download ${res.status}`);
  return { done: true, mp4: Buffer.from(await res.arrayBuffer()) };
}

/** Gemini TTS: speak `text` (style cues allowed, e.g. "Say warmly: ..."). Returns a WAV. */
export async function speak(text: string, voice = "Puck", model = "gemini-2.5-flash-preview-tts") {
  const data = await call(`models/${model}:generateContent`, {
    method: "POST",
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    }),
  });
  const b64 = data.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData)?.inlineData?.data as string | undefined;
  if (!b64) throw new Error("TTS returned no audio");
  return pcmToWav(Buffer.from(b64, "base64"), 24000);
}

function pcmToWav(pcm: Buffer, rate: number) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
