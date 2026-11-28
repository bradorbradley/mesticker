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
import { cn } from "@/lib/utils";
import { LAYOUTS, SHEET_H, SHEET_W } from "@/lib/sheet-layouts";
import { CarolGames } from "./games/carol-games";

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
export function EventReveal({ sticker, onPrint, onRetake, onRetry, canRetry, form }: { sticker: string; onPrint: () => void; onRetake: () => void; onRetry: () => void; canRetry: boolean; form?: React.ReactNode }) {
  return (
    <div className={cn("flex h-full w-full items-center landscape:flex-row landscape:justify-center portrait:flex-col", form && "portrait:overflow-y-auto")} style={{ gap: form ? u(1.2) : u(3), padding: form ? `${u(0.8)} ${u(2)} ${u(1.5)}` : `${u(1)} ${u(4)} ${u(2.5)}` }}>
      <div className={cn("relative flex items-center justify-center landscape:h-full landscape:w-[44%] portrait:w-full", form ? "portrait:h-[32vh] portrait:shrink-0" : "portrait:min-h-0 portrait:flex-1")}>
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
      <div className={cn("flex flex-col landscape:w-[48%] portrait:items-center portrait:text-center", form && "w-full max-w-md landscape:max-h-full landscape:overflow-y-auto landscape:py-2")} style={{ gap: form ? u(1) : u(1.6) }}>
        <h2 className="t-h2">
          Look at <span className="pop">you!</span>
        </h2>
        <p className={form ? "t-body short:hidden" : "t-lead"}>{form ? "Add your name for your name stickers, then print!" : "Your sheet: this cartoon, you with Fred, Augustine & Alex, name stickers and 8 festive poses."}</p>
        {form ?? (
          <button className="btn btn-lg btn-main w-fit" onClick={onPrint}>
            🖨️ Print my stickers
          </button>
        )}
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
  /** manga-style motion: speed lines, an impact flash, a camera shake */
  fx?: ("speed" | "impact" | "shake" | "flash")[];
  /** a big comic sound word, e.g. "WHOOSH!" */
  sfx?: string;
  /** punch in on whoever has this key */
  zoom?: string;
  /** an interactive chapter: play CarolGames game N (0 snowball toss, 1 target practice, 2 memory) */
  game?: number;
};
const SLOT_X: Record<Slot, number> = { L: 4, LC: 20, C: 36, RC: 52, R: 68 }; // left edge, % of stage width
const ACTOR_W = 28; // % of stage width
const ACTOR_BIG = 34;

export function storyBeats(event: PartyEvent, look: Look, me: string, pose: (k: number) => string, name: string | null): Beat[] {
  const who = name || "friend";
  const hosts = look.hosts;
  const host = (i: number) => hosts[Math.min(i, hosts.length - 1)];
  // die-cut versions (white sticker edge) so the hosts match the guest's stickers
  const H = (i: number, at: Slot, extra: Partial<Actor> = {}): Actor => ({ key: `h${i}`, src: host(i).cut ?? host(i).img, at, anim: "bob", ...extra });
  const santa = look.cameo?.cut ?? look.cameo?.img ?? hosts[0].img;
  const S = (at: Slot, extra: Partial<Actor> = {}): Actor => ({ key: "santa", src: santa, at, anim: "bob", ...extra });
  const G = (at: Slot, extra: Partial<Actor> = {}): Actor => ({ key: "guest", src: me, at, anim: "bob", big: true, ...extra });
  const P = (k: number, at: Slot, extra: Partial<Actor> = {}): Actor => ({ key: `p${k}`, src: pose(k), at, anim: "bob", big: true, ...extra });
  const trio = (extra: Partial<Actor> = {}) => [H(0, "L", extra), H(1, "C", extra), H(2, "R", extra)];
  const n = (i: number) => hosts[Math.min(i, hosts.length - 1)].name;
  // sticker order: 0 reindeer, 1 stocking, 2 ornament, 3 sled, 4 snowball, 5 present, 6 solo, 7 carols with the hosts, 8 stockings with the hosts, 9 Santa's sleigh
  // ~29s: one clear idea per frame, long enough to read, always something moving
  return [
    { scene: "home", ms: 2300, cast: trio({ anim: "jump" }), caption: `WELCOME TO ${event.name.toUpperCase()}!`, sfx: "♪♫♪", fx: ["flash"] },
    { scene: "home", ms: 2300, cast: trio(), bubble: { who: "h1", text: `We're ${n(0)}, ${n(1)} & ${n(2)}!` } },
    { scene: "home", ms: 1700, cast: trio(), caption: "KNOCK KNOCK!", door: "knock", fx: ["shake"], sfx: "KNOCK!" },
    { scene: "home", ms: 2100, cast: [H(0, "L"), G("RC", { anim: "jump" })], door: "open", ribbon: `It's ${who}!`, fx: ["impact", "flash"], sfx: "TA-DA!" },
    { scene: "home", ms: 1900, cast: [G("L"), S("R", { anim: "jump" })], caption: "SUDDENLY…", fx: ["shake", "impact"], sfx: "CRASH!" },
    { scene: "home", ms: 2300, cast: [G("L"), S("R")], bubble: { who: "santa", text: "My reindeer escaped! Help!" } },
    { scene: "home", ms: 1700, cast: [G("L", { anim: "jump" }), S("R")], bubble: { who: "guest", text: "On it! 💪" }, fx: ["speed"] },
    { scene: "street", ms: 2000, cast: [P(3, "LC", { anim: "zoom" })], caption: "DOWN THE HILL…", fx: ["speed"], sfx: "WHOOSH!" },
    { scene: "street", ms: 2000, cast: [P(4, "L", { anim: "jump" }), H(1, "R", { anim: "jump" })], bubble: { who: "h1", text: "Hey! 😂" }, fx: ["impact"], sfx: "SPLAT!" },
    { scene: "street", ms: 2100, cast: [P(0, "LC", { anim: "fly", lift: 18 })], caption: "FOUND THE REINDEER!", fx: ["speed", "flash"], sfx: "GIDDY UP!" },
    { scene: "roof", ms: 2400, cast: [P(9, "C", { anim: "fly", big: true, lift: 10 })], caption: "OFF WITH SANTA!", bubble: { who: "p9", text: "Christmas is saved!" }, sfx: "HO HO HO!", fx: ["speed"] },
    { scene: "home", ms: 2200, cast: [P(8, "C", { anim: "jump", big: true })], caption: "BACK HOME BY THE FIRE…", sfx: "HA HA!", fx: ["flash"] },
    { scene: "home", ms: 3000, cast: [P(7, "C", { anim: "jump", big: true })], caption: "AND EVERYONE SANG!", notes: true, fx: ["flash"], ribbon: "Game time! 🎮" },
  ];
}

export function WelcomeVideo({ event, look, sticker, poses = [], name, etaSec, onEnd, games = false }: { event: PartyEvent; look: Look; sticker: string | null; poses?: (string | null | false)[]; name: string | null; etaSec?: number; onEnd?: () => void; games?: boolean }) {
  const me = sticker ?? look.hosts[0].img;
  const pose = (k: number) => (typeof poses[k] === "string" ? (poses[k] as string) : me);
  // the games are chapters of the story (left out when watching it again)
  const beats = storyBeats(event, look, me, pose, name).filter((b) => games || b.game == null);
  const gameStickers = Array.from(new Set([...poses.filter((p): p is string => typeof p === "string"), me]));
  // pace the whole story to the estimated wait (fixed once it starts)
  const pace = useRef<number | null>(null);
  if (pace.current === null) {
    const base = beats.reduce((t, b) => t + b.ms, 0);
    pace.current = etaSec && base ? 1 : 1; // fixed: games fill the rest of the wait
    try {
      const forced = Number(localStorage.getItem("mesticker-story-pace")); // testing: e.g. 0.3
      if (forced > 0) pace.current = forced;
    } catch {}
  }
  // load every backdrop and sticker up front so no scene starts blank
  useEffect(() => {
    const urls = [look.scene, look.scenes?.street, look.scenes?.roof, ...beats.flatMap((b) => b.cast.map((c) => c.src))].filter((x): x is string => !!x);
    new Set(urls).forEach((u) => {
      const im = new Image();
      im.src = u;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [i, setI] = useState(0);
  const next = () => (i + 1 < beats.length ? setI(i + 1) : onEnd?.());
  useEffect(() => {
    if (beats[i].game != null) return; // a game chapter moves on when it's played
    const t = setTimeout(next, beats[i].ms * pace.current!);
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
  const rightSide = !!speaker && xOf(speaker) + widthOf(speaker) / 2 > stageW * 0.55; // bubble grows leftward, tail on the right
  const bubbleLeft = speaker ? Math.max(8, Math.min(stageW - stageW * 0.46, xOf(speaker) + widthOf(speaker) * 0.15)) : stageW * 0.3;
  const bubbleRight = speaker ? Math.max(8, stageW - (xOf(speaker) + widthOf(speaker) * 0.85)) : 0;
  const fx = new Set(beat.fx ?? []);
  const zoomed = beat.zoom ? beat.cast.find((a) => a.key === beat.zoom) : undefined;
  const zoomOn = !!zoomed && stageW > 0;
  const zoomAt = zoomed ? `${((xOf(zoomed) + widthOf(zoomed) / 2) / (stageW || 1)) * 100}% ${100 - ((yOf(zoomed) + heightOf(zoomed) * 0.7) / (stageH || 1)) * 100}%` : "50% 50%";
  const bubbleBottom = speaker ? Math.min(stageH * 0.78, yOf(speaker) + heightOf(speaker) * 0.92) : stageH * 0.6;

  return (
    <div ref={box} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* the same scene, blurred, fills the screen around the stage */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={backdrop} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-75" />
      {stageW > 0 && (
        <div className="relative overflow-hidden rounded-[18px] shadow-[0_18px_50px_rgba(0,0,0,0.45)]" style={{ width: stageW, height: stageH }}>
          {/* the "camera": punches in on the speaker, shakes on impacts */}
          <motion.div
            className="absolute inset-0"
            style={{ transformOrigin: zoomAt }}
            animate={{ scale: zoomOn ? 1.22 : i % 2 ? 1.08 : 1.02, x: fx.has("shake") ? [0, -10, 9, -7, 6, -3, (i % 2) * 0.01] : 0, y: fx.has("shake") ? [0, 5, -6, 4, -2, (i % 2) * 0.01] : 0 }}
            transition={{ scale: { duration: 0.5, ease: "easeOut" }, x: { duration: 0.45 }, y: { duration: 0.45 } }}
          >
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
                  style={{
                    width: w,
                    height: heightOf(a),
                    bottom: y,
                    zIndex: a.key === "guest" || a.key.startsWith("p") ? 20 : 10,
                  }}
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
              <motion.div key={`b${i}`} className={cn("comic-bubble absolute z-40", rightSide && "tail-right")} style={{ ...(rightSide ? { right: bubbleRight } : { left: bubbleLeft }), bottom: bubbleBottom, maxWidth: stageW * 0.46 }} initial={{ scale: 0.3, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: "spring", stiffness: 280, damping: 17 }}>
                {beat.bubble.text}
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
          {fx.has("speed") && <SpeedLines key={`s${i}`} />}
          {fx.has("impact") && <ImpactBurst key={`i${i}`} />}
          {fx.has("flash") && <motion.div key={`f${i}`} className="pointer-events-none absolute inset-0 z-[45] bg-white" initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />}
          <AnimatePresence>
            {beat.sfx && (
              <motion.div key={`x${i}`} className="manga-sfx pointer-events-none absolute right-[5%] top-[30%] z-[46]" initial={{ scale: 0.2, rotate: -25, opacity: 0 }} animate={{ scale: [0.2, 1.35, 1], rotate: 10, opacity: 1 }} exit={{ opacity: 0, scale: 1.6 }} transition={{ duration: 0.4 }}>
                {beat.sfx}
              </motion.div>
            )}
          </AnimatePresence>
          {/* story progress */}
          <div className="absolute inset-x-0 bottom-0 z-50 h-1.5 bg-black/30">
            <div className="h-full bg-[#ffd36b] transition-[width] duration-300" style={{ width: `${((i + 1) / beats.length) * 100}%` }} />
          </div>
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
      {beat.game != null && (
        <div className="absolute inset-0 z-[52] bg-[#2a0d0b]">
          <CarolGames key={i} only={beat.game} durationMs={beat.ms} stickers={gameStickers} hero={me} hosts={look.hosts.map((h) => ({ name: h.name, img: h.cut ?? h.img }))} name={name} onDone={next} />
        </div>
      )}
      {look.music && beat.game == null && (
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

/** manga speed lines radiating from the centre */
function SpeedLines() {
  const lines = Array.from({ length: 28 }, (_, k) => k);
  return (
    <motion.svg className="pointer-events-none absolute inset-0 z-[44] h-full w-full" viewBox="-50 -50 100 100" preserveAspectRatio="none" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0.6, 0.9], rotate: [0, 3] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: "mirror" }}>
      {lines.map((k) => {
        const a = (k / lines.length) * Math.PI * 2 + (k % 3) * 0.05;
        const r0 = 30 + (k % 4) * 5;
        return <line key={k} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * 80} y2={Math.sin(a) * 80} stroke="white" strokeWidth={k % 2 ? 0.5 : 1.1} strokeLinecap="round" opacity={0.85} />;
      })}
    </motion.svg>
  );
}

/** a jagged comic impact star that pops and fades */
function ImpactBurst() {
  const pts = Array.from({ length: 24 }, (_, k) => {
    const a = (k / 24) * Math.PI * 2;
    const r = k % 2 ? 22 : 46;
    return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`;
  }).join(" ");
  return (
    <motion.svg className="pointer-events-none absolute left-1/2 top-1/2 z-[44] h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2" viewBox="0 0 100 100" initial={{ scale: 0.2, opacity: 1, rotate: -20 }} animate={{ scale: 1.3, opacity: 0, rotate: 10 }} transition={{ duration: 0.55, ease: "easeOut" }}>
      <polygon points={pts} fill="#ffd36b" stroke="#c0392b" strokeWidth={2} />
    </motion.svg>
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

/**
 * Every sticker the guest got, big, floating with a little drift: the guest's own stickers (with
 * their name ribbons and white die-cut borders), not a tiny picture of the sheet.
 */
export function FloatingStickers({ stickers, className, sheet }: { stickers: string[]; className?: string; sheet?: { logo?: string; pill?: string; frame?: string; decor?: string[] } }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const float = (k: number, cell: number) => ({
    animate: { y: [0, -cell * 0.04, 0], rotate: [k % 2 ? -2.5 : 2.5, k % 2 ? 2.5 : -2.5, k % 2 ? -2.5 : 2.5] },
    transition: { duration: 2.6 + (k % 4) * 0.4, repeat: Infinity, ease: "easeInOut" as const, delay: (k % 5) * 0.3 },
  });
  const pop = (k: number) => ({ initial: { scale: 0, rotate: -15, opacity: 0 }, animate: { scale: 1, rotate: 0, opacity: 1 }, transition: { type: "spring" as const, stiffness: 200, damping: 13, delay: 0.1 + k * 0.06 } });
  const img = "h-full w-full object-contain drop-shadow-[0_8px_10px_rgba(60,8,10,0.35)]";

  // portrait: laid out like the printed sheet (logo, hero and groups big, name stickers, poses, the pill,
  // inside the trim border), without the white sheet behind
  const full = !!(sheet?.logo && sheet?.pill);
  const slots = full ? LAYOUTS.event15 : LAYOUTS.event15.slice(1, -1);
  const portrait = size.h >= size.w * 0.9 && stickers.length >= 6;
  if (portrait) {
    const decor = full ? (sheet!.decor ?? []) : [];
    const own = slots.length - 2 - decor.length; // the guest's slots (between the logo and the decorations)
    const mine = stickers.slice(0, full ? own : slots.length);
    const srcs = full ? [sheet!.logo!, ...mine, ...(mine.length === own ? decor : []), sheet!.pill!] : mine;
    const used = full
      ? [slots[0], ...slots.slice(1, 1 + mine.length), ...(mine.length === own ? slots.slice(1 + own, 1 + own + decor.length) : []), slots[slots.length - 1]]
      : slots.slice(0, srcs.length);
    const framed = full && !!sheet?.frame;
    const x0 = framed ? 0 : Math.min(...used.map((sl) => sl[0])), y0 = framed ? 0 : Math.min(...used.map((sl) => sl[1]));
    const x1 = framed ? SHEET_W : Math.max(...used.map((sl) => sl[0] + sl[2])), y1 = framed ? SHEET_H : Math.max(...used.map((sl) => sl[1] + sl[3]));
    const k = Math.min(size.w / (x1 - x0), size.h / (y1 - y0));
    return (
      <div ref={box} className={cn("relative", className)}>
        <div className="absolute left-1/2 top-1/2" style={{ width: (x1 - x0) * k, height: (y1 - y0) * k, transform: "translate(-50%, -50%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {framed && <img src={sheet!.frame} alt="" className="absolute inset-0 h-full w-full" />}
          {srcs.map((src, i) => {
            const [x, y, w, h] = used[i];
            const brand = full && (i === 0 || i > mine.length);
            return (
              <motion.div key={`${i}-${src.slice(-24)}`} className="absolute" style={{ left: (x - x0) * k, top: (y - y0) * k, width: w * k, height: h * k }} {...pop(i)}>
                <motion.img src={src} alt="" className={img} {...(brand ? {} : float(i, h * k))} />
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // landscape: the column count that gives the biggest stickers while showing every one
  const list = Array.from(new Set([...(sheet?.logo ? [sheet.logo] : []), ...stickers, ...(sheet?.pill ? [sheet.pill] : [])])).slice(0, 15);
  const n = list.length || 1;
  let cols = 1, cell = 0;
  for (let c = 1; c <= n; c++) {
    const rows = Math.ceil(n / c);
    const sz = Math.min(size.w / c, size.h / rows);
    if (sz > cell) [cols, cell] = [c, sz];
  }
  return (
    <div ref={box} className={cn("relative flex items-center justify-center", className)}>
      {cell > 0 && (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gridAutoRows: `${cell}px` }}>
          {list.map((src, k) => (
            <motion.div key={src} className="flex items-center justify-center" style={{ padding: cell * 0.04 }} {...pop(k)}>
              <motion.img src={src} alt="" className={img} {...float(k, cell)} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The end (right after the games): the whole sheet's stickers floating, big. On a phone, one tap saves
 * every sticker to Photos; on the booth's tablet, a QR sends them to the guest's own phone.
 */
export function EventDone({
  stickers,
  onFinish,
  emailedTo,
  sheet,
  orderId,
  handset = true,
  albumUrl,
}: {
  /** the event's class photo and gallery, open to guests once their stickers are made */
  albumUrl?: string | null;
  stickers: string[];
  onFinish: () => void;
  emailedTo: string | null;
  sheet?: { logo?: string; pill?: string; frame?: string; decor?: string[] };
  orderId?: string | null;
  handset?: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (handset || !orderId) return;
    QRCode.toDataURL(`${location.origin}/booth/mine/${orderId}`, { width: 360, margin: 1, color: { dark: "#3b1210", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [handset, orderId]);
  const save = async () => {
    setStatus("Getting them ready…");
    const { saveImages } = await import("./my-order-stickers");
    setStatus(await saveImages(Array.from(new Set(stickers))).catch(() => "Tip: press and hold any sticker to save it."));
  };
  return (
    <div className="flex h-full w-full landscape:flex-row landscape:items-center portrait:flex-col" style={{ gap: u(1.6), padding: `${u(1)} ${u(2)} max(${u(2)}, env(safe-area-inset-bottom))` }}>
      <Snow />
      <FloatingStickers stickers={stickers} sheet={sheet} className="min-h-0 flex-1 landscape:h-full" />
      <div className="z-10 flex shrink-0 flex-col items-center text-center landscape:w-[34%]" style={{ gap: u(1) }}>
        <h2 className="t-h2">
          Merry <span className="pop">Christmas!</span>
        </h2>
        <p className="t-body">Grab your sheet from the printer and peel away.{emailedTo ? ` We're emailing every sticker to ${emailedTo}.` : ""}</p>
        {qr ? (
          <div className="card flex items-center text-left" style={{ gap: u(1.2), padding: u(1.2) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Scan to get your stickers" style={{ width: `max(120px, ${u(14)})` }} />
            <div className="t-h3" style={{ maxWidth: "9em" }}>
              📲 Scan to save your stickers to your phone
            </div>
          </div>
        ) : (
          <button className="btn btn-lg btn-main w-fit" onClick={save}>
            📲 Save my stickers to Photos
          </button>
        )}
        {status && <p className="t-body">{status}</p>}
        {handset && albumUrl && (
          <a className="btn btn-soft w-fit" href={albumUrl} target="_blank">
            🎓 See the class photo
          </a>
        )}
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
  const [phase, setPhase] = useState<"video" | "games" | "save">("video");
  const [run, setRun] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const firstEta = useRef(info.etaSec);
  useEffect(() => {
    if (handset || !orderId) return;
    QRCode.toDataURL(`${location.origin}/booth/mine/${orderId}`, { width: 320, margin: 1, color: { dark: "#3b1210", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [handset, orderId]);

  const unique = Array.from(new Set(stickers));
  // the games' cast: every pose sticker and the hero (the hosts are added by the games)
  const gameStickers = Array.from(new Set([...poses.filter((p): p is string => typeof p === "string"), ...(sticker ? [sticker] : [])]));

  const save = async () => {
    setSaved("Getting them ready…");
    const { saveImages } = await import("./my-order-stickers");
    setSaved(await saveImages(unique).catch(() => "Tip: press and hold a sticker to save it."));
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#2a0d0b]">
      {phase === "video" ? (
        <WelcomeVideo key={run} event={event} look={look} sticker={sticker} poses={poses} name={name} etaSec={run ? undefined : firstEta.current} onEnd={() => setPhase("games")} />
      ) : phase === "games" ? (
        <CarolGames stickers={gameStickers} hero={sticker ?? look.hosts[0].img} hosts={look.hosts.map((h) => ({ name: h.name, img: h.cut ?? h.img }))} name={name} durationMs={60000} onDone={onDone} />
      ) : (
        <div className="relative flex h-full w-full items-center text-center landscape:flex-row portrait:flex-col" style={{ gap: u(1.6), padding: "16px 16px 84px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={look.scene} alt="" className="fixed inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
          <FloatingStickers stickers={stickers} className="relative min-h-0 w-full flex-1 landscape:h-full" />
          <div className="relative flex shrink-0 flex-col items-center landscape:w-[36%]" style={{ gap: u(1), maxWidth: 420 }}>
          <h2 className="t-h2 !text-[#fbefd5]">Your stickers! 🎉</h2>
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
        <div className="absolute bottom-20 left-3 z-[51] flex items-center rounded-2xl bg-white/90 p-2 shadow-lg" style={{ gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Scan to get your stickers" style={{ width: `max(72px, ${u(8)})` }} />
          <div className="text-left text-xs font-bold text-[#3b1210]" style={{ maxWidth: "7em" }}>
            Scan for your stickers 📲
          </div>
        </div>
      )}

      {/* status + done, floating (the games have their own bars) */}
      <div className={cn("inset-x-0 bottom-0 z-50 flex justify-center p-3", phase === "games" ? "hidden" : "absolute")} style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
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
