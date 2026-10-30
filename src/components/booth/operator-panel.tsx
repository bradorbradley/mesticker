"use client";

import { SHEETS_PER_CASSETTE } from "@/lib/booth-config";

export interface BoothSettings {
  sheetsLeft: number;
  freeMode: boolean;
  salesToday: number;
  salesDate: string;
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
  const row = "flex items-center justify-between gap-6 border-b border-[var(--line)] py-4";
  const small = "btn-ghost px-5 py-2 text-lg";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(31,32,48,0.55)]" onClick={onClose}>
      <div className="sticker-card w-[min(720px,92vw)] p-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="display text-4xl">Staff panel</h2>
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
            <span className="display w-14 text-center text-4xl">{settings.sheetsLeft}</span>
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
            className={settings.freeMode ? "btn-primary px-6 py-2 text-lg" : small}
            onClick={() => update({ freeMode: !settings.freeMode })}
          >
            {settings.freeMode ? "On" : "Off"}
          </button>
        </div>

        <div className={row}>
          <div className="text-xl font-semibold">Prints today</div>
          <span className="display text-4xl">{settings.salesToday}</span>
        </div>

        <div className={row}>
          <div className="text-xl font-semibold">Last generation</div>
          <span className="text-lg text-[var(--ink-2)]">
            {lastGen ? `${lastGen.provider} · ${lastGen.model} · ${(lastGen.ms / 1000).toFixed(1)}s` : "—"}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className={small} disabled={!canReprint} onClick={onReprint}>
            Download print file again
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
