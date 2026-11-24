"use client";

import { useEffect, useState } from "react";
import { BOOTH_STYLE, SHEETS_PER_CASSETTE } from "@/lib/booth-config";
import { eventStyleOptions } from "@/lib/presets";

/**
 * Which AI draws the stickers. "default" = whatever Vercel's env vars say.
 * Nano Banana = Google Gemini Flash Image (needs GEMINI_API_KEY in Vercel).
 */
export type ImageModel = "default" | "openai" | "nano" | "mixed";
export const IMAGE_MODELS: { id: ImageModel; label: string; hint: string }[] = [
  { id: "default", label: "Default", hint: "OpenAI main sticker; Nano Banana sheet stickers when the Google key is set" },
  { id: "openai", label: "OpenAI", hint: "best match to the web app, ~12–15 s" },
  { id: "mixed", label: "Mixed", hint: "OpenAI main sticker, Nano Banana sheet stickers" },
  { id: "nano", label: "Nano Banana", hint: "Google, fastest" },
];
/** What the booth sends as `provider` for the main sticker and the sheet stickers. */
export function providersFor(m: ImageModel | undefined): { hero?: string; extras?: string } {
  if (m === "openai") return { hero: "openai", extras: "openai" };
  if (m === "nano") return { hero: "gemini", extras: "gemini" };
  if (m === "mixed") return { hero: "openai", extras: "gemini" };
  return {};
}

export interface BoothSettings {
  sheetsLeft: number;
  freeMode: boolean;
  salesToday: number;
  salesDate: string;
  imageModel?: ImageModel;
  /** Cartoon style for this event (a preset id). Unset = BOOTH_STYLE (chibi). */
  eventStyle?: string;
  /** Optional theme for this event, worked into outfits and props. */
  eventTheme?: string;
}

export interface GenStats {
  provider: string;
  model: string;
  ms: number;
}

/** Hidden staff panel — opened by holding the MeSticker logo for 2 seconds. */
export default function OperatorPanel({
  settings,
  update,
  lastGen,
  canReprint,
  canMarkPaid,
  onReprint,
  onMarkPaid,
  onReset,
  onClose,
}: {
  settings: BoothSettings;
  update: (patch: Partial<BoothSettings>) => void;
  lastGen: GenStats | null;
  canReprint: boolean;
  canMarkPaid: boolean;
  onReprint: () => void;
  onMarkPaid: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const row = "flex items-center justify-between gap-6 border-b border-[#eee8ff] py-4";
  const [keys, setKeys] = useState<{ openai: boolean; gemini: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/booth/providers")
      .then((r) => r.json())
      .then((d) => setKeys(d.keys))
      .catch(() => {});
  }, []);
  const model = settings.imageModel ?? "default";
  const needsGemini = model === "nano" || model === "mixed";
  const small = "btn btn-soft";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(26,26,46,0.55)]" onClick={onClose}>
      <div className="card max-h-[92vh] w-[min(720px,92vw)] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="t-h2">Staff panel</h2>
          <button className={small} onClick={onClose}>
            Close
          </button>
        </div>

        <div className={row}>
          <div>
            <div className="text-xl font-semibold">Sticker sheets left</div>
            <div className="text-[var(--ink-2)]">Booth shows &ldquo;out of stickers&rdquo; at 0</div>
          </div>
          <div className="flex items-center gap-3">
            <button className={small} onClick={() => update({ sheetsLeft: Math.max(0, settings.sheetsLeft - 1) })}>
              −
            </button>
            <span className="font-fun w-14 text-center text-4xl font-bold">{settings.sheetsLeft}</span>
            <button className={small} onClick={() => update({ sheetsLeft: settings.sheetsLeft + 1 })}>
              +
            </button>
            <button className={small} onClick={() => update({ sheetsLeft: SHEETS_PER_CASSETTE })}>
              Refilled ({SHEETS_PER_CASSETTE})
            </button>
          </div>
        </div>

        <div className={row}>
          <div>
            <div className="text-xl font-semibold">Free mode</div>
            <div className="text-[var(--ink-2)]">Skip payment (demos, private events)</div>
          </div>
          <button
            className={settings.freeMode ? "btn btn-main" : small}
            onClick={() => update({ freeMode: !settings.freeMode })}
          >
            {settings.freeMode ? "On" : "Off"}
          </button>
        </div>

        <div className={row}>
          <div className="text-xl font-semibold">Prints today</div>
          <span className="t-h2">{settings.salesToday}</span>
        </div>

        <div className={`${row} flex-wrap`}>
          <div>
            <div className="text-xl font-semibold">Image model</div>
            <div className="text-[var(--ink-2)]">{IMAGE_MODELS.find((m) => m.id === model)?.hint}</div>
            {keys && (
              <div className={keys.gemini ? "text-[#15803d]" : needsGemini ? "font-semibold text-[var(--pink)]" : "text-[var(--ink-2)]"}>
                {keys.gemini
                  ? "✓ Nano Banana key found"
                  : "Nano Banana needs GEMINI_API_KEY in Vercel (then redeploy). Until then it uses OpenAI."}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {IMAGE_MODELS.map((m) => (
              <button key={m.id} className={model === m.id ? "btn btn-main" : small} onClick={() => update({ imageModel: m.id })}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`${row} flex-wrap`}>
          <div>
            <div className="text-xl font-semibold">Event style</div>
            <div className="text-[var(--ink-2)]">Every sticker at this booth uses it, until you change it</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {eventStyleOptions.map((p) => (
              <button
                key={p.id}
                className={(settings.eventStyle ?? BOOTH_STYLE) === p.id ? "btn btn-main" : small}
                onClick={() => update({ eventStyle: p.id })}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className={`${row} flex-wrap`}>
          <div>
            <div className="text-xl font-semibold">Event theme</div>
            <div className="text-[var(--ink-2)]">Optional, e.g. &ldquo;holiday party: Santa hats, ugly sweaters&rdquo;. Leave empty for none.</div>
          </div>
          <input
            className="w-full rounded-xl border-2 border-[#eee8ff] px-4 py-3 text-lg"
            maxLength={200}
            defaultValue={settings.eventTheme ?? ""}
            onBlur={(e) => update({ eventTheme: e.target.value.trim() || undefined })}
            placeholder="No theme"
          />
        </div>

        <div className={row}>
          <div className="text-xl font-semibold">Last generation</div>
          <span className="text-lg text-[var(--ink-2)]">
            {lastGen ? `${lastGen.provider} · ${lastGen.model} · ${(lastGen.ms / 1000).toFixed(1)}s` : "—"}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className={small} disabled={!canReprint} onClick={onReprint}>
            Open the Liene kit again
          </button>
          <button className={small} disabled={!canMarkPaid} onClick={onMarkPaid}>
            Mark as paid (cash)
          </button>
          <button className={small} onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
            Fullscreen
          </button>
          <button className={small} onClick={onReset}>
            Reset booth
          </button>
        </div>
      </div>
    </div>
  );
}
