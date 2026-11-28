"use client";

import { useMemo, useState } from "react";
import type { AlbumEntry } from "@/lib/guests";

type Person = { name: string; img: string; host?: boolean };

const RED = "#a3161c", CREAM = "#fbefd5", INK = "#3b1210", GOLD = "#d4a24c";
const script = { fontFamily: 'var(--font-carol, "Lobster"), cursive' } as const;

/** The class photo as one PNG (title, hosts' row, every guest with their name), for sharing. */
async function classPhotoPng(title: string, sub: string, people: Person[], family: string): Promise<Blob> {
  const load = (src: string) =>
    new Promise<HTMLImageElement | null>((ok) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => ok(im);
      im.onerror = () => ok(null);
      im.src = src;
    });
  await document.fonts.load(`80px ${family}`).catch(() => {});
  const imgs = await Promise.all(people.map((p) => load(p.img)));
  const hosts = people.filter((p) => p.host).length;
  const guests = people.length - hosts;
  const cols = Math.max(4, Math.min(8, Math.ceil(Math.sqrt(guests * 1.6))));
  const cell = 300, label = 64, pad = 80, head = 300;
  const rows = Math.ceil(guests / cols);
  const W = pad * 2 + cols * cell;
  const H = head + (hosts ? cell + label + 30 : 0) + rows * (cell + label) + pad;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.fillStyle = CREAM;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = RED;
  x.lineWidth = 10;
  x.strokeRect(24, 24, W - 48, H - 48);
  x.strokeStyle = GOLD;
  x.lineWidth = 4;
  x.strokeRect(40, 40, W - 80, H - 80);
  x.textAlign = "center";
  x.fillStyle = RED;
  x.font = `120px ${family}`;
  x.fillText(title, W / 2, 170);
  x.fillStyle = INK;
  x.font = `52px ${family}`;
  x.fillText(sub, W / 2, 245);
  const draw = (i: number, cx: number, top: number) => {
    const im = imgs[i];
    if (im) {
      const k = Math.min((cell - 30) / im.width, (cell - 10) / im.height);
      x.drawImage(im, cx - (im.width * k) / 2, top + cell - im.height * k, im.width * k, im.height * k);
    }
    x.fillStyle = people[i].host ? RED : INK;
    x.font = `44px ${family}`;
    x.fillText(people[i].name, cx, top + cell + 48, cell - 16);
  };
  let y = head;
  if (hosts) {
    for (let i = 0; i < hosts; i++) draw(i, W / 2 + (i - (hosts - 1) / 2) * cell, y);
    y += cell + label + 30;
  }
  for (let g = 0; g < guests; g++) {
    const r = Math.floor(g / cols), inRow = r === rows - 1 ? guests - r * cols : cols;
    const cx = W / 2 + ((g % cols) - (inRow - 1) / 2) * cell; // a short last row is centred
    draw(hosts + g, cx, y + r * (cell + label));
  }
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("no image"))), "image/png"));
}

export default function EventAlbum({ name, when, hosts, entries, owner }: { name: string; when: string | null; hosts: { name: string; img: string }[]; entries: AlbumEntry[]; owner: boolean }) {
  const [busy, setBusy] = useState(false);
  // one spot per person in the class photo (their latest cartoon); every creation in the gallery
  const classmates = useMemo(() => {
    const byName = new Map<string, AlbumEntry>();
    entries.forEach((e) => byName.set((e.name ?? e.orderId).trim().toLowerCase(), e));
    return [...byName.values()];
  }, [entries]);
  const people: Person[] = [...hosts.map((h) => ({ ...h, host: true })), ...classmates.map((e) => ({ name: e.name ?? "Guest", img: e.stickerUrl }))];
  const sub = `Class of ${when ?? "tonight"} · ${classmates.length} ${classmates.length === 1 ? "guest" : "guests"}`;

  const download = async () => {
    setBusy(true);
    try {
      const family = getComputedStyle(document.querySelector(".album")!).getPropertyValue("--font-carol").trim() || "cursive";
      const blob = await classPhotoPng(name, sub, people, family);
      const file = new File([blob], "class-photo.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => {});
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="album min-h-screen" style={{ background: `linear-gradient(${CREAM}, #f3dcb0)`, color: INK }}>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-8 text-center">
        <h1 style={{ ...script, color: RED, fontSize: "clamp(34px, 7vw, 72px)", lineHeight: 1.05 }}>{name}</h1>
        <p style={{ ...script, fontSize: "clamp(18px, 3vw, 28px)" }}>{sub}</p>
        {owner && <p className="mt-1 text-sm font-semibold">Owner view: everyone, including guests who didn&apos;t tick &quot;feature me&quot;.</p>}

        <div className="mx-auto mt-6 rounded-[28px] border-4 bg-white/60 p-4 sm:p-8" style={{ borderColor: RED, boxShadow: `inset 0 0 0 3px ${GOLD}` }}>
          <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-2">
            {hosts.map((h) => (
              <figure key={h.name} className="w-[26%] max-w-[170px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.img} alt={h.name} className="mx-auto aspect-square w-full object-contain" />
                <figcaption style={{ ...script, color: RED, fontSize: "clamp(16px, 2.6vw, 26px)" }}>{h.name}</figcaption>
              </figure>
            ))}
          </div>
          {classmates.length ? (
            <div className="mt-4 flex flex-wrap justify-center gap-x-2 gap-y-4">
              {classmates.map((e) => (
                <figure key={e.orderId} className="w-[30%] sm:w-[22%] md:w-[15%] lg:w-[13%]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.stickerUrl} alt={e.name ?? "Guest"} loading="lazy" className="mx-auto aspect-square w-full object-contain drop-shadow-[0_6px_8px_rgba(60,8,10,0.25)]" />
                  <figcaption className="truncate" style={{ ...script, fontSize: "clamp(14px, 2.2vw, 22px)" }}>{e.name ?? "Guest"}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="mt-6 font-semibold">The class photo fills in as guests make their stickers.</p>
          )}
        </div>
        <button onClick={download} disabled={busy || !classmates.length} className="mt-5 rounded-full px-7 py-3 text-lg font-bold text-white disabled:opacity-50" style={{ background: RED, boxShadow: `0 0 0 3px ${GOLD}` }}>
          {busy ? "Making it…" : "📸 Save the class photo"}
        </button>
      </section>

      {entries.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="text-center" style={{ ...script, color: RED, fontSize: "clamp(26px, 5vw, 48px)" }}>The real you &amp; the cartoon you</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => (
              <figure key={e.orderId} className="overflow-hidden rounded-3xl bg-white shadow-md">
                <div className="grid grid-cols-2">
                  {e.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.photoUrl} alt="" loading="lazy" className="aspect-square h-full w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-[#f3dcb0] text-3xl">📸</div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.stickerUrl} alt="" loading="lazy" className="aspect-square h-full w-full bg-[#fff8ea] object-contain p-2" />
                </div>
                <figcaption className="py-2 text-center" style={{ ...script, fontSize: 22 }}>{e.name ?? "Guest"}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
