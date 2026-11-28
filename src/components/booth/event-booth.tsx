"use client";

/**
 * Screens for a booked event's own booth (/booth/<slug> with a `look`): the hosts as chibi mascots,
 * the event's art and colours, a one-picture reveal, and the welcome video that plays while the
 * sheet prints. The flow underneath is the regular booth's.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import type { PartyEvent } from "@/lib/party-events";
import { u } from "./units";

type Look = NonNullable<PartyEvent["look"]>;

/**
 * The welcome video's music. Phones only let a page play sound from inside a tap, and the video
 * starts a few seconds after the guest taps Print, so the tap "unlocks" this one audio element
 * (start + immediate pause) and the video plays it later.
 */
let music: HTMLAudioElement | null = null;
export function primeMusic(url?: string) {
  if (!url || typeof Audio === "undefined") return;
  if (!music || !music.src.endsWith(url)) {
    music = new Audio(url);
    music.loop = true;
    music.preload = "auto";
  }
  const a = music;
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    })
    .catch(() => {
      a.muted = false;
    });
}

/** The hosts side by side, gently bobbing: the event's mascots. */
export function HostsMascot({ look, className, style }: { look: Look; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`flex items-end justify-center overflow-visible ${className ?? ""}`} style={style}>
      {look.hosts.map((h, i) => (
        <motion.img
          key={h.name}
          src={h.img}
          alt={h.name}
          className="h-full min-w-0 object-contain drop-shadow-[0_8px_14px_rgba(80,10,10,0.25)]"
          style={{ width: `${100 / look.hosts.length + 4}%`, marginLeft: i ? "-4%" : 0, zIndex: i === 1 ? 2 : 1 }}
          animate={{ y: [0, i === 1 ? -10 : -6, 0], rotate: [0, i % 2 ? 2 : -2, 0] }}
          transition={{ duration: 1.6 + i * 0.25, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** Start screen: the invite, the hosts, tap to start, and a QR to use your own phone. */
export function EventAttract({ event, look, onStart, outOfPaper, qrPath, phone }: { event: PartyEvent; look: Look; onStart: () => void; outOfPaper: boolean; qrPath: string; phone: boolean }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (phone) return;
    QRCode.toDataURL(`${location.origin}${qrPath}`, { width: 360, margin: 1, color: { dark: "#3a1410", light: "#ffffff" } })
      .then(setQr)
      .catch(() => {});
  }, [phone, qrPath]);

  return (
    <button className="relative flex h-full w-full items-center justify-center text-left" onClick={onStart} disabled={outOfPaper}>
      <div className="flex h-full w-full items-center justify-center landscape:flex-row portrait:flex-col" style={{ gap: u(3), padding: `${u(1)} ${u(4)} ${u(2.5)}` }}>
        <div className="flex flex-col items-center text-center landscape:w-[50%] short:gap-2" style={{ gap: u(1.6) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={look.logo} alt={event.name} className="w-[min(92%,640px)] drop-shadow-[0_10px_20px_rgba(80,10,10,0.25)] short:max-h-[36vh] short:w-auto" />
          {event.when && <div className="carol-ribbon short:!text-[18px]">{event.when}</div>}
          <p className="t-lead max-w-[28ch] short:hidden">Become a cartoon and peel off your own sticker sheet, printed right here. Free tonight!</p>
          {outOfPaper ? (
            <div className="t-h3 card w-fit" style={{ padding: `${u(1.2)} ${u(2.4)}` }}>
              Out of stickers. Back in a minute!
            </div>
          ) : (
            <motion.div className="btn btn-lg btn-main w-fit" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
              Tap to start 🎄
            </motion.div>
          )}
          <ol className="flex flex-wrap justify-center short:hidden" style={{ gap: `${u(0.6)} ${u(1.4)}` }}>
            {["Snap a pic", "See your cartoon", "Print & peel"].map((t, i) => (
              <li key={t} className="t-body flex items-center" style={{ gap: u(0.6) }}>
                <span className="carol-num">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <div className="relative flex items-center justify-center landscape:h-full landscape:flex-1 portrait:w-full portrait:min-h-0 portrait:flex-1">
          <HostsMascot look={look} className="h-[62%] max-h-full w-full portrait:h-full short:h-[78%]" />
          {qr && !phone && !outOfPaper && (
            <div className="card absolute bottom-[3%] right-[2%] z-20 flex items-center short:hidden" style={{ gap: u(1), padding: u(1) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Scan to use your phone" className="shrink-0 bg-white" style={{ width: `max(96px, ${u(10)})`, height: `max(96px, ${u(10)})` }} />
              <div style={{ maxWidth: "10em" }}>
                <div className="t-h3">📱 Use your phone</div>
                <div className="t-body">Scan to snap on your own phone. It prints right here.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/** One picture: the guest's cartoon, then straight to printing (no sheet choices). */
export function EventReveal({ sticker, onPrint, onRetake, onRetry, canRetry }: { sticker: string; onPrint: () => void; onRetake: () => void; onRetry: () => void; canRetry: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center landscape:flex-row portrait:flex-col" style={{ gap: u(3), padding: `${u(1)} ${u(4)} ${u(2.5)}` }}>
      <div className="relative flex items-center justify-center landscape:h-full landscape:w-[48%] portrait:w-full portrait:min-h-0 portrait:flex-1">
        <motion.div
          className="absolute rounded-full"
          style={{ width: "78%", aspectRatio: "1", background: "radial-gradient(circle, rgba(255,214,140,0.55), transparent 65%)" }}
          animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
        <motion.img
          src={sticker}
          alt="Your cartoon"
          className="die-cut relative max-h-[88%] max-w-[88%] object-contain"
          initial={{ scale: 0.3, rotate: -18, opacity: 0 }}
          animate={{ scale: 1, rotate: -3, opacity: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 11 }}
        />
      </div>
      <div className="flex flex-col landscape:w-[42%] portrait:items-center portrait:text-center" style={{ gap: u(1.6) }}>
        <h2 className="t-h2">
          Look at <span className="pop">you!</span>
        </h2>
        <p className="t-lead">Your sheet gets this cartoon plus 8 festive poses, and the 387 Christmas Carols sticker.</p>
        <button className="btn btn-lg btn-main w-fit" onClick={onPrint}>
          🖨️ Print my stickers
        </button>
        <div className="flex flex-wrap" style={{ gap: u(1) }}>
          <button className="btn btn-soft" onClick={onRetake}>
            📸 New photo
          </button>
          {canRetry && (
            <button className="btn btn-soft" onClick={onRetry}>
              🔄 Redraw it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The welcome video while the sheet prints, full screen: a little story starring the guest. The
 * hosts say hi, there's a knock, the guest's cartoon walks in, Santa needs help, and the guest goes on
 * an adventure using their own pose stickers, with comic captions, speech bubbles and music.
 *
 * Staged, not piled up: at most three characters at a time, each in its own spot (left / centre /
 * right), sized to the stage, bubbles above whoever's talking. Paced to the real wait: the whole
 * story stretches or tightens to the print's estimated time, then `onEnd` (the save screen).
 */
type Slot = "L" | "C" | "R" | "LC" | "RC";
type Actor = { key: string; src: string; at: Slot; anim?: "bob" | "jump" | "fly" | "zoom"; big?: boolean; lift?: number };
type Beat = {
  scene: "home" | "street" | "roof";
  ms: number;
  cast: Actor[];
  caption?: string;
  bubble?: { who: string; text: string };
  ribbon?: string;
  door?: "knock" | "open";
  notes?: boolean;
};
const SLOT_X: Record<Slot, number> = { L: 4, LC: 20, C: 36, RC: 52, R: 68 }; // left edge, % of stage width
const ACTOR_W = 28; // % of stage width
const ACTOR_BIG = 34;

export function storyBeats(event: PartyEvent, look: Look, me: string, pose: (k: number) => string, name: string | null): Beat[] {
  const who = name || "friend";
  const hosts = look.hosts;
  const H = (i: number, at: Slot, extra: Partial<Actor> = {}): Actor => ({ key: `h${i}`, src: hosts[Math.min(i, hosts.length - 1)].img, at, anim: "bob", ...extra });
  const santa = look.cameo?.img ?? hosts[0].img;
  const S = (at: Slot, extra: Partial<Actor> = {}): Actor => ({ key: "santa", src: santa, at, anim: "bob", ...extra });
  const G = (at: Slot, extra: Partial<Actor> = {}): Actor => ({ key: "guest", src: me, at, anim: "bob", big: true, ...extra });
  const P = (k: number, at: Slot, extra: Partial<Actor> = {}): Actor => ({ key: `p${k}`, src: pose(k), at, anim: "bob", big: true, ...extra });
  const trio = (extra: Partial<Actor> = {}) => [H(0, "L", extra), H(1, "C", extra), H(2, "R", extra)];
  const n = (i: number) => hosts[Math.min(i, hosts.length - 1)].name;
  return [
    { scene: "home", ms: 2400, cast: trio(), bubble: { who: "h0", text: `Hi, I'm ${n(0)}!` } },
    { scene: "home", ms: 2200, cast: trio(), bubble: { who: "h1", text: `I'm ${n(1)}!` } },
    { scene: "home", ms: 2400, cast: trio(), bubble: { who: "h2", text: `And I'm ${n(2)}!` } },
    { scene: "home", ms: 2800, cast: trio({ anim: "jump" }), caption: `WELCOME TO ${event.name.toUpperCase()}!` },
    { scene: "home", ms: 2200, cast: trio(), caption: "KNOCK KNOCK! 🚪", door: "knock" },
    { scene: "home", ms: 2200, cast: trio(), bubble: { who: "h1", text: "Who could it be?" }, door: "knock" },
    { scene: "home", ms: 3000, cast: [H(0, "L"), G("RC", { anim: "jump" })], door: "open", ribbon: `It's ${who}!` },
    { scene: "home", ms: 2600, cast: [H(0, "L", { anim: "jump" }), H(2, "C", { anim: "jump" }), G("R")], door: "open", bubble: { who: "h2", text: `Welcome, ${who}! 🎄` } },
    { scene: "home", ms: 2600, cast: [G("L"), S("R", { anim: "jump" })], caption: "SUDDENLY…", bubble: { who: "santa", text: "Ho ho… OH NO!" } },
    { scene: "home", ms: 3000, cast: [G("L"), S("R")], bubble: { who: "santa", text: "My reindeer ran away!" } },
    { scene: "home", ms: 2500, cast: [G("L", { anim: "jump" }), S("R")], bubble: { who: "guest", text: "I'll find them! 💪" } },
    { scene: "street", ms: 3200, cast: [P(3, "L", { anim: "zoom" })], caption: "MEANWHILE, OUTSIDE…", bubble: { who: "p3", text: "Wheeeee!" } },
    { scene: "street", ms: 2800, cast: [P(4, "L", { anim: "jump" }), H(1, "R")], bubble: { who: "h1", text: "Hey! No fair! ❄️" } },
    { scene: "street", ms: 2800, cast: [P(6, "C", { anim: "zoom" })], caption: `SMOOTH MOVES, ${who.toUpperCase()}!` },
    { scene: "street", ms: 3000, cast: [P(0, "LC", { anim: "fly", lift: 20 })], caption: "FOUND ONE!", bubble: { who: "p0", text: "Giddy up! 🦌" } },
    { scene: "roof", ms: 3000, cast: [P(0, "L", { anim: "fly", lift: 30 })], caption: "UP ON THE ROOFTOP…" },
    { scene: "roof", ms: 3000, cast: [P(5, "L"), S("RC", { anim: "jump" })], bubble: { who: "santa", text: "Presents saved!" } },
    { scene: "roof", ms: 2600, cast: trio({ anim: "jump" }), caption: "HOORAY FOR " + who.toUpperCase() + "!" },
    { scene: "home", ms: 2800, cast: [P(1, "C")], caption: "BACK AT 387…", bubble: { who: "p1", text: "Tree's done! ⭐" } },
    { scene: "home", ms: 2600, cast: [P(7, "C")], bubble: { who: "p7", text: "Cocoa break ☕" } },
    { scene: "home", ms: 4400, cast: [H(0, "L", { anim: "jump" }), P(2, "C", { anim: "jump" }), H(2, "R", { anim: "jump" })], caption: "AND EVERYONE SANG 🎶", notes: true, ribbon: "Your stickers are almost ready!" },
  ];
}

export function WelcomeVideo({ event, look, sticker, poses = [], name, etaSec, onEnd }: { event: PartyEvent; look: Look; sticker: string | null; poses?: (string | null | false)[]; name: string | null; etaSec?: number; onEnd?: () => void }) {
  const me = sticker ?? look.hosts[0].img;
  const pose = (k: number) => (typeof poses[k] === "string" ? (poses[k] as string) : me);
  const beats = storyBeats(event, look, me, pose, name);
  // pace the whole story to the estimated wait (fixed once it starts)
  const pace = useRef<number | null>(null);
  if (pace.current === null) {
    const base = beats.reduce((t, b) => t + b.ms, 0);
    pace.current = etaSec ? Math.min(2.2, Math.max(0.8, (etaSec * 1000 * 0.9) / base)) : 1;
    try {
      const forced = Number(localStorage.getItem("mesticker-story-pace")); // testing: e.g. 0.3
      if (forced > 0) pace.current = forced;
    } catch {}
  }
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => (i + 1 < beats.length ? setI(i + 1) : onEnd?.()), beats[i].ms * pace.current!);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  const beat = beats[i];

  // measure the stage so characters and bubbles are placed in real pixels
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tall = size.h > size.w * 0.8; // portrait phones: a 4:5 stage, cropped backdrop, no door
  const stageW = size.w && size.h ? Math.min(size.w, size.h * (tall ? 0.8 : 16 / 9)) : 0;
  const stageH = tall ? stageW / 0.8 : stageW * (9 / 16);
  const floor = stageH * 0.05;
  const widthOf = (a: Actor) => (stageW * (a.big ? ACTOR_BIG : ACTOR_W)) / 100;
  const heightOf = (a: Actor) => widthOf(a) * 1.18;
  const xOf = (a: Actor) => (stageW * SLOT_X[a.at]) / 100 + (a.big ? -stageW * 0.03 : 0);
  const yOf = (a: Actor) => floor + (stageH * (a.lift ?? 0)) / 100;

  // music, unlocked by the Print tap (primeMusic)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!look.music) return;
    if (!music || !music.src.endsWith(look.music)) primeMusic(look.music);
    const a = music!;
    a.volume = 0.55;
    a.muted = false;
    audioRef.current = a;
    a.play().catch(() => setBlocked(true));
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, [look.music]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const backdrop = (beat.scene === "street" ? look.scenes?.street : beat.scene === "roof" ? look.scenes?.roof : look.scene) ?? look.scene;
  const speaker = beat.bubble ? beat.cast.find((a) => a.key === beat.bubble!.who) : undefined;
  const bubbleLeft = speaker ? Math.max(8, Math.min(stageW - stageW * 0.46, xOf(speaker) + widthOf(speaker) * 0.15)) : stageW * 0.3;
  const bubbleBottom = speaker ? Math.min(stageH * 0.78, yOf(speaker) + heightOf(speaker) * 0.92) : stageH * 0.6;

  return (
    <div ref={box} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* the same scene, blurred, fills the screen around the stage */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={backdrop} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-75" />
      {stageW > 0 && (
        <div className="relative overflow-hidden rounded-[18px] shadow-[0_18px_50px_rgba(0,0,0,0.45)]" style={{ width: stageW, height: stageH }}>
          <AnimatePresence initial={false}>
            <motion.img key={beat.scene} src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: tall ? "40% 50%" : "50% 50%" }} initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }} />
          </AnimatePresence>
          <Snow />

          {beat.scene === "home" && !tall && (
            <>
              <div className="absolute z-[6] rounded-t-[6px]" style={{ left: "86.4%", top: "24%", width: "13.2%", height: "53.4%", background: "radial-gradient(circle at 50% 40%, #fff3c8, #e9a64b 70%, #8a4b1a)" }} />
              <motion.div
                className="absolute z-[7] origin-left rounded-t-[6px] border-[2px] border-[#5e1010] bg-[#8f1d1d]"
                style={{ left: "86.4%", top: "24%", width: "13.2%", height: "53.4%", transformPerspective: 600 }}
                animate={beat.door === "open" ? { rotateY: -82, x: 0 } : beat.door === "knock" ? { rotateY: 0, x: [0, -3, 3, -2, 2, 0] } : { rotateY: 0, x: 0 }}
                transition={beat.door === "open" ? { duration: 0.9, ease: "easeOut" } : { duration: 0.45, repeat: beat.door === "knock" ? 3 : 0 }}
              >
                <div className="absolute left-1/2 top-[16%] aspect-square w-[62%] -translate-x-1/2 rounded-full border-[5px] border-[#2f6b3a]" />
              </motion.div>
            </>
          )}

          <AnimatePresence>
            {beat.cast.map((a) => {
              const x = xOf(a), w = widthOf(a), y = yOf(a);
              const travel = a.anim === "zoom" || a.anim === "fly" ? stageW * 0.34 : 0;
              return (
                <motion.img
                  key={`${beat.scene}-${a.key}`}
                  src={a.src}
                  alt=""
                  className="absolute object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.3)]"
                  style={{ width: w, height: heightOf(a), bottom: y, zIndex: a.key === "guest" || a.key.startsWith("p") ? 20 : 10 }}
                  initial={{ opacity: 0, scale: 0.4, left: x - (a.anim === "zoom" ? stageW * 0.15 : 0) }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    left: x + travel,
                    y: a.anim === "jump" ? [0, -stageH * 0.06, 0] : a.anim === "fly" ? [0, -stageH * 0.04, 0] : [0, -stageH * 0.015, 0],
                    rotate: a.anim === "zoom" ? [-4, 4, -4] : a.anim === "fly" ? [-6, 2, -6] : 0,
                  }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{
                    left: { duration: travel ? (beat.ms * pace.current!) / 1000 : 0.8, ease: travel ? "linear" : "easeInOut" },
                    y: { duration: a.anim === "jump" ? 0.55 : 1.2, repeat: Infinity, ease: "easeInOut" },
                    rotate: { duration: 0.8, repeat: Infinity },
                    opacity: { duration: 0.3 },
                    scale: { type: "spring", stiffness: 180, damping: 14 },
                  }}
                />
              );
            })}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {beat.caption && (
              <motion.div key={`c${i}`} className="comic-caption absolute left-[3%] top-[4%] z-40" style={{ maxWidth: "70%", whiteSpace: "normal" }} initial={{ x: -40, opacity: 0, rotate: -6 }} animate={{ x: 0, opacity: 1, rotate: -2 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}>
                {beat.caption}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {beat.bubble && (
              <motion.div key={`b${i}`} className="comic-bubble absolute z-40" style={{ left: bubbleLeft, bottom: bubbleBottom, maxWidth: stageW * 0.46 }} initial={{ scale: 0.3, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: "spring", stiffness: 280, damping: 17 }}>
                {beat.bubble.text}
              </motion.div>
            )}
          </AnimatePresence>
          {beat.notes && <Notes />}
          <AnimatePresence>
            {beat.ribbon && (
              <motion.div key={`r${i}`} className="absolute inset-x-0 top-[16%] z-40 flex justify-center" initial={{ scale: 0.3, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.3 }}>
                <div className="carol-ribbon carol-ribbon-lg">{beat.ribbon}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {look.music && (
        <button
          className="absolute right-3 top-3 z-50 rounded-full bg-black/45 px-3 py-1.5 text-sm font-bold text-white"
          onClick={() => {
            if (blocked && audioRef.current) audioRef.current.play().then(() => setBlocked(false)).catch(() => {});
            else setMuted((m) => !m);
          }}
        >
          {blocked ? "🔊 Tap for music" : muted ? "🔇" : "🔊"}
        </button>
      )}
    </div>
  );
}

function Notes() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {Array.from({ length: 10 }, (_, k) => (
        <motion.span
          key={k}
          className="absolute text-[#fbefd5]"
          style={{ left: `${10 + k * 8}%`, bottom: "40%", fontSize: 18 + (k % 3) * 8, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [-10, -120], opacity: [0, 1, 0], x: [0, k % 2 ? 14 : -14] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: k * 0.25 }}
        >
          {k % 2 ? "♪" : "♫"}
        </motion.span>
      ))}
    </div>
  );
}

function Snow() {
  const flakes = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {flakes.map((i) => (
        <motion.span
          key={i}
          className="absolute block rounded-full bg-white/80"
          style={{ left: `${(i * 37) % 100}%`, width: 4 + (i % 4) * 2, height: 4 + (i % 4) * 2 }}
          initial={{ top: "-5%" }}
          animate={{ top: "105%", x: [0, i % 2 ? 12 : -12, 0] }}
          transition={{ duration: 6 + (i % 5), repeat: Infinity, delay: (i % 9) * 0.7, ease: "linear" }}
        />
      ))}
    </div>
  );
}

/** Making the cartoon (~20 s): the hosts dance around the guest's photo, with snow and a countdown. */
export function EventGenerating({ look, photo, ready }: { look: Look; photo: string | null; ready: boolean }) {
  const lines = ["Warming up the choir…", "Drawing you in chibi style…", "Hanging the tinsel…", "Adding a sprinkle of snow…", "Tying it with a bow…", "Almost ready to sing…"];
  const [n, setN] = useState(30);
  const [k, setK] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setN((x) => Math.max(0, x - 1)), 1000);
    const b = setInterval(() => setK((x) => (x + 1) % lines.length), 3200);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [lines.length]);
  const dancers = [...look.hosts, ...(look.cameo ? [look.cameo] : [])];
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden" style={{ gap: u(2) }}>
      <Snow />
      <div className="relative flex items-center justify-center" style={{ width: "min(78vw, 58vh)", aspectRatio: "1" }}>
        {/* the hosts circling the photo */}
        <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }}>
          {dancers.map((d, i) => {
            const ang = (i / dancers.length) * Math.PI * 2;
            return (
              <motion.img
                key={d.name}
                src={d.img}
                alt={d.name}
                className="absolute w-[30%] drop-shadow-[0_6px_10px_rgba(80,10,10,0.3)]"
                style={{ left: `${50 + Math.cos(ang) * 44 - 15}%`, top: `${50 + Math.sin(ang) * 44 - 15}%` }}
                animate={{ rotate: -360, y: [0, -12, 0] }}
                transition={{ rotate: { duration: 14, repeat: Infinity, ease: "linear" }, y: { duration: 0.7 + i * 0.1, repeat: Infinity } }}
              />
            );
          })}
        </motion.div>
        <motion.div className="absolute rounded-full" style={{ width: "54%", aspectRatio: "1", background: "conic-gradient(#a3161c, #e2b65a, #a3161c, #e2b65a, #a3161c)", padding: 6 }} animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
          <div className="h-full w-full rounded-full bg-[#fbf2e1]" />
        </motion.div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Your photo" className="absolute rounded-full object-cover" style={{ width: "50%", aspectRatio: "1" }} />
        )}
      </div>
      <div className="z-10 text-center">
        <div className="t-hero" style={{ lineHeight: 1 }}>{ready ? "Ta-da!" : n}</div>
        <AnimatePresence mode="wait">
          <motion.p key={k} className="t-lead" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {lines[k]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The end: their sheet and cartoon, and one tap to save every sticker to their photos. */
export function EventDone({ sticker, sheet, stickers, onFinish, emailedTo }: { sticker: string | null; sheet: string | null; stickers: string[]; onFinish: () => void; emailedTo: string | null }) {
  const [status, setStatus] = useState<string | null>(null);
  const save = async () => {
    try {
      const all = Array.from(new Set([...(sheet ? [sheet] : []), ...stickers]));
      const files = await Promise.all(
        all.map(async (src, i) => {
          const b = await (await fetch(src)).blob();
          return new File([b], `mesticker-${i + 1}.${b.type.includes("png") ? "png" : b.type.includes("webp") ? "webp" : "jpg"}`, { type: b.type || "image/png" });
        })
      );
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files }); // iOS: "Save N Images"
        setStatus("Saved! 🎉");
        return;
      }
      for (const f of files) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        a.click();
      }
      setStatus("Saved to your downloads!");
    } catch {
      setStatus("Tip: press and hold any sticker to save it.");
    }
  };
  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto landscape:flex-row portrait:flex-col portrait:justify-start portrait:pt-8" style={{ gap: u(2.4), paddingLeft: u(3), paddingRight: u(3), paddingBottom: u(2) }}>
      <Snow />
      <div className="relative flex items-center justify-center landscape:h-full landscape:w-[44%] portrait:h-[40vh] portrait:w-full portrait:shrink-0" style={{ gap: u(1.6) }}>
        {sheet && (
          <motion.img
            src={sheet}
            alt="Your sticker sheet"
            className="h-full max-h-full w-auto rounded-[12px] bg-white shadow-[0_18px_40px_rgba(80,10,10,0.3)] landscape:max-h-[86%] landscape:h-auto"
            style={{ aspectRatio: "3.9 / 6.7", maxWidth: "60%", padding: 6 }}
            initial={{ rotate: -8, y: 40, opacity: 0 }}
            animate={{ rotate: -3, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 14 }}
          />
        )}
        {sticker && (
          <motion.img
            src={sticker}
            alt="Your cartoon"
            className="die-cut max-h-[70%] w-[40%] object-contain"
            initial={{ scale: 0.4, rotate: 12, opacity: 0 }}
            animate={{ scale: 1, rotate: 4, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 12, delay: 0.25 }}
          />
        )}
      </div>
      <div className="z-10 flex flex-col landscape:w-[40%] portrait:items-center portrait:text-center" style={{ gap: u(1.4) }}>
        <h2 className="t-h2">
          Merry <span className="pop">Christmas!</span>
        </h2>
        <p className="t-lead">Grab your sheet from the printer and peel away. {emailedTo ? `We're emailing every sticker to ${emailedTo}.` : ""}</p>
        <button className="btn btn-lg btn-main w-fit" onClick={save}>
          📲 Save my stickers to Photos
        </button>
        {status && <p className="t-body">{status}</p>}
        <button className="btn btn-soft w-fit" onClick={onFinish}>
          Done
        </button>
      </div>
    </div>
  );
}

export type WaitInfo = { pct: number; label: string; detail?: string; done: boolean; etaSec: number };

/**
 * Full-screen wait while the sheet prints: the story, then (if it's still printing) a save screen so
 * guests keep busy. A slim status bar and "I've got my stickers" float on top. On a booth screen
 * (not the guest's own phone) a QR gets the stickers onto their phone.
 */
export function EventWait({
  event,
  look,
  sticker,
  poses,
  name,
  info,
  orderId,
  handset,
  sheet,
  stickers,
  onDone,
}: {
  event: PartyEvent;
  look: Look;
  sticker: string | null;
  poses: (string | null | false)[];
  name: string | null;
  info: WaitInfo;
  orderId: string | null;
  handset: boolean;
  sheet: string | null;
  stickers: string[];
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"video" | "save">("video");
  const [run, setRun] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const firstEta = useRef(info.etaSec);
  useEffect(() => {
    if (handset || !orderId) return;
    QRCode.toDataURL(`${location.origin}/booth/mine/${orderId}`, { width: 320, margin: 1, color: { dark: "#3b1210", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [handset, orderId]);

  const save = async () => {
    setSaved("Getting them ready…");
    const { saveImages } = await import("./my-order-stickers");
    setSaved(await saveImages(Array.from(new Set([...(sheet ? [sheet] : []), ...stickers]))).catch(() => "Tip: press and hold a sticker to save it."));
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#2a0d0b]">
      {phase === "video" ? (
        <WelcomeVideo key={run} event={event} look={look} sticker={sticker} poses={poses} name={name} etaSec={run ? undefined : firstEta.current} onEnd={() => setPhase("save")} />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center overflow-y-auto text-center landscape:flex-row portrait:flex-col" style={{ gap: u(2.4), padding: "16px 16px 84px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={look.scene} alt="" className="fixed inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
          {sheet && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sheet} alt="Your sticker sheet" className="relative w-auto shrink-0 rounded-xl bg-white p-1.5 shadow-2xl landscape:max-h-[78%] portrait:max-h-[42vh]" style={{ aspectRatio: "3.9 / 6.7" }} />
          )}
          <div className="relative flex flex-col items-center" style={{ gap: u(1.2), maxWidth: 420 }}>
          <h2 className="t-h2 !text-[#fbefd5]">While it prints…</h2>
          <p className="t-lead !text-[#f3dcb0]">Save all your stickers to your phone, ready to send to friends.</p>
          {handset ? (
            <button className="btn btn-lg btn-main relative" onClick={save}>
              📲 Save my stickers to Photos
            </button>
          ) : (
            qr && (
              <div className="card relative flex items-center text-left" style={{ gap: u(1.2), padding: u(1.2) }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Scan to get your stickers" style={{ width: `max(110px, ${u(13)})` }} />
                <div className="t-h3" style={{ maxWidth: "9em" }}>
                  📲 Scan to get your stickers on your phone
                </div>
              </div>
            )
          )}
          {saved && <p className="t-body relative !text-[#fbefd5]">{saved}</p>}
          <button
            className="btn btn-soft relative"
            onClick={() => {
              setRun((r) => r + 1);
              setPhase("video");
            }}
          >
            ▶ Watch the story again
          </button>
          </div>
        </div>
      )}

      {/* QR in the corner during the story too (booth screens) */}
      {phase === "video" && qr && (
        <div className="absolute left-3 top-3 z-40 flex items-center rounded-2xl bg-white/90 p-2 shadow-lg" style={{ gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Scan to get your stickers" style={{ width: `max(72px, ${u(8)})` }} />
          <div className="text-left text-xs font-bold text-[#3b1210]" style={{ maxWidth: "7em" }}>
            Scan for your stickers 📲
          </div>
        </div>
      )}

      {/* status + done, floating */}
      <div className="absolute inset-x-0 bottom-0 z-50 flex justify-center p-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div className="flex w-full max-w-xl items-center rounded-full bg-black/55 py-2 pl-5 pr-2 text-white backdrop-blur" style={{ gap: 12 }}>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{info.label}</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/25">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#e2b65a] to-[#fbefd5]" animate={{ width: `${Math.round(info.pct * 100)}%` }} transition={{ duration: 0.8 }} />
            </div>
          </div>
          <button className={info.done ? "btn btn-main shrink-0" : "btn btn-soft shrink-0 !py-2 text-sm"} onClick={onDone}>
            {info.done ? "Got them! 🎉" : "I've got my stickers"}
          </button>
        </div>
      </div>
    </div>
  );
}
