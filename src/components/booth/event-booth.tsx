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
    <div className={`flex items-end justify-center ${className ?? ""}`} style={style}>
      {look.hosts.map((h, i) => (
        <motion.img
          key={h.name}
          src={h.img}
          alt={h.name}
          className="h-full w-auto object-contain drop-shadow-[0_8px_14px_rgba(80,10,10,0.25)]"
          style={{ marginLeft: i ? "-6%" : 0, zIndex: i === 1 ? 2 : 1 }}
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
        <div className="flex flex-col items-center text-center landscape:w-[50%]" style={{ gap: u(1.6) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={look.logo} alt={event.name} className="w-[min(92%,640px)] drop-shadow-[0_10px_20px_rgba(80,10,10,0.25)]" />
          {event.when && <div className="carol-ribbon">{event.when}</div>}
          <p className="t-lead max-w-[28ch]">Become a cartoon and peel off your own sticker sheet, printed right here. Free tonight!</p>
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
          <HostsMascot look={look} className="h-[62%] max-h-full w-full portrait:h-full" />
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
 * The welcome video while the sheet prints: a little animated story starring the guest. The hosts
 * say hi, there's a knock, the guest's cartoon walks in, then Santa needs help and the guest goes on
 * an adventure (sledding, a snowball fight, skating, a reindeer ride over the rooftops) using their
 * own pose stickers, with comic captions, speech bubbles and music. Drawn live, so it starts the
 * moment printing does; after the first run the adventure loops until the sheet is done.
 */
type Actor = { key: string; src: string; left: number; bottom: number; h: number; anim?: "bob" | "jump" | "fly" | "zoom" | "still"; flip?: boolean; z?: number; dur?: number };
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

export function WelcomeVideo({ event, look, sticker, poses = [], name }: { event: PartyEvent; look: Look; sticker: string | null; poses?: (string | null | false)[]; name: string | null }) {
  const who = name || "friend";
  const me = sticker ?? look.hosts[0].img;
  const pose = (k: number) => (typeof poses[k] === "string" ? (poses[k] as string) : me);
  const hosts = look.hosts;
  const H = (i: number, left: number, extra: Partial<Actor> = {}): Actor => ({ key: `h${i}`, src: hosts[Math.min(i, hosts.length - 1)].img, left, bottom: 6, h: 48, anim: "bob", ...extra });
  const santa = look.cameo?.img ?? hosts[0].img;
  const S = (left: number, extra: Partial<Actor> = {}): Actor => ({ key: "santa", src: santa, left, bottom: 5, h: 50, anim: "bob", ...extra });
  const G = (left: number, extra: Partial<Actor> = {}): Actor => ({ key: "guest", src: me, left, bottom: 6, h: 54, anim: "bob", z: 20, ...extra });
  const P = (k: number, left: number, extra: Partial<Actor> = {}): Actor => ({ key: `p${k}`, src: pose(k), left, bottom: 8, h: 56, anim: "bob", z: 20, ...extra });
  const trio = (x = 16, step = 14, extra: Partial<Actor> = {}) => hosts.map((_, i) => H(i, x + i * step, extra));
  const [h0, h1, h2] = [hosts[0]?.name, hosts[1]?.name ?? hosts[0]?.name, hosts[2]?.name ?? hosts[0]?.name];

  const beats: Beat[] = [
    { scene: "home", ms: 2300, cast: trio(), bubble: { who: "h0", text: `Hi, I'm ${h0}!` } },
    { scene: "home", ms: 2100, cast: trio(), bubble: { who: "h1", text: `I'm ${h1}!` } },
    { scene: "home", ms: 2300, cast: trio(), bubble: { who: "h2", text: `And I'm ${h2}!` } },
    { scene: "home", ms: 2600, cast: trio(), bubble: { who: "h1", text: `Welcome to ${event.name}!` } },
    { scene: "home", ms: 2000, cast: trio(), caption: "KNOCK KNOCK!", door: "knock" },
    { scene: "home", ms: 2300, cast: trio(), bubble: { who: "h0", text: "Ooh, a new guest! Who is it?" }, door: "knock" },
    { scene: "home", ms: 2800, cast: [...trio(), G(83, { h: 50, anim: "jump" })], door: "open", ribbon: `It's ${who}!` },
    { scene: "home", ms: 2700, cast: [...trio(16, 14, { anim: "jump" }), G(64)], door: "open", bubble: { who: "h2", text: `Welcome, ${who}! 🎄` } },
    // the adventure (loops from here)
    { scene: "home", ms: 2700, cast: [...trio(), G(64), S(1, { anim: "jump", h: 56 })], caption: "SUDDENLY…", bubble: { who: "santa", text: "Ho ho… OH NO!" } },
    { scene: "home", ms: 3400, cast: [...trio(), G(64), S(1, { h: 56 })], bubble: { who: "santa", text: "My reindeer ran off and the presents are stuck on the roof!" } },
    { scene: "home", ms: 2600, cast: [...trio(16, 14, { anim: "jump" }), G(64), S(1, { h: 56 })], bubble: { who: "h1", text: `${who}, you're our only hope!` } },
    { scene: "home", ms: 2500, cast: [...trio(), G(64, { anim: "jump" }), S(1, { h: 56 })], bubble: { who: "guest", text: "Leave it to me! 💪" } },
    { scene: "street", ms: 3200, cast: [P(3, 4, { anim: "zoom", bottom: 30, h: 46 })], caption: "MEANWHILE, OUTSIDE…", bubble: { who: "p3", text: "Wheeeee!" } },
    { scene: "street", ms: 3000, cast: [P(3, 58, { anim: "zoom", bottom: 10, h: 46, dur: 3 }), H(0, 72, { anim: "jump", h: 40 })], bubble: { who: "h0", text: "Out of the way!" } },
    { scene: "street", ms: 3000, cast: [P(4, 8, { anim: "jump" }), H(1, 62, { anim: "jump", h: 42 }), H(2, 76, { h: 42 })], caption: "SNOWBALL FIGHT!", bubble: { who: "h1", text: "Hey! No fair! ❄️" } },
    { scene: "street", ms: 3000, cast: [P(6, 30, { anim: "zoom", h: 54 })], caption: `SMOOTH MOVES, ${who.toUpperCase()}.` },
    { scene: "street", ms: 3200, cast: [P(0, 36, { anim: "fly", bottom: 40, h: 50 })], caption: "LOOK! A REINDEER!", bubble: { who: "p0", text: "Giddy up! 🦌" } },
    { scene: "roof", ms: 3200, cast: [P(0, 6, { anim: "fly", bottom: 44, h: 48 })], caption: "UP ON THE ROOFTOP…", bubble: { who: "p0", text: "To the sleigh!" } },
    { scene: "roof", ms: 3400, cast: [P(5, 48, { h: 52 }), S(66, { anim: "jump", bottom: 14, h: 50 })], bubble: { who: "santa", text: `Presents saved! Thank you, ${who}!` } },
    { scene: "roof", ms: 2800, cast: [P(5, 48, { anim: "jump", h: 52 }), S(66, { bottom: 14, h: 50 }), ...trio(6, 13, { anim: "jump", h: 36, bottom: 4 })], caption: "THE WHOLE CITY CHEERED!" },
    { scene: "home", ms: 3000, cast: [P(1, 6, { h: 60 }), H(2, 50)], caption: "BACK AT 387…", bubble: { who: "h2", text: "The tree is finally done!" } },
    { scene: "home", ms: 2800, cast: [P(7, 40, { h: 58 }), H(0, 16), H(1, 64)], bubble: { who: "p7", text: "Cocoa break! ☕" } },
    { scene: "home", ms: 4600, cast: [...trio(8, 13, { anim: "jump" }), P(2, 50, { anim: "jump", h: 58 }), S(70, { anim: "jump", h: 50 })], caption: "AND EVERYONE SANG HAPPILY EVER AFTER", notes: true, ribbon: "Your stickers are almost ready!" },
  ];
  const LOOP_FROM = 8;

  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setI((x) => (x + 1 < beats.length ? x + 1 : LOOP_FROM)), beats[i].ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  const beat = beats[i];

  // music: starts with the video (the guest just tapped Print, so the browser allows it)
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const backdrop = beat.scene === "street" ? look.scenes?.street : beat.scene === "roof" ? look.scenes?.roof : look.scene;
  const speaker = beat.bubble ? beat.cast.find((a) => a.key === beat.bubble!.who) : undefined;

  return (
    <div className="carol-scene relative w-full overflow-hidden rounded-[22px] bg-[#3b1210] shadow-[0_18px_40px_rgba(80,10,10,0.35)]" style={{ aspectRatio: "16 / 9" }}>
      <AnimatePresence initial={false}>
        <motion.img key={beat.scene} src={backdrop ?? look.scene} alt="" className="absolute inset-0 h-full w-full object-cover" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }} />
      </AnimatePresence>
      <Snow />

      {/* home: the front door (right side of the backdrop) */}
      {beat.scene === "home" && (
        <>
          <div className="absolute z-[6] rounded-t-[6px]" style={{ left: "86.4%", top: "24%", width: "13.2%", height: "53.4%", background: "radial-gradient(circle at 50% 40%, #fff3c8, #e9a64b 70%, #8a4b1a)" }} />
          <motion.div
            className="absolute z-[7] origin-left rounded-t-[6px] border-[2px] border-[#5e1010] bg-[#8f1d1d]"
            style={{ left: "86.4%", top: "24%", width: "13.2%", height: "53.4%", transformPerspective: 600 }}
            animate={beat.door === "open" ? { rotateY: -82, x: 0 } : beat.door === "knock" ? { rotateY: 0, x: [0, -3, 3, -2, 2, 0] } : { rotateY: 0, x: 0 }}
            transition={beat.door === "open" ? { duration: 0.9, ease: "easeOut" } : { duration: 0.45, repeat: beat.door === "knock" ? 3 : 0 }}
          >
            <div className="absolute left-1/2 top-[16%] aspect-square w-[62%] -translate-x-1/2 rounded-full border-[5px] border-[#2f6b3a]" />
            <div className="absolute right-[10%] top-[55%] h-2 w-2 rounded-full bg-[#e8c56b]" />
          </motion.div>
        </>
      )}

      {/* the cast */}
      <AnimatePresence>
        {beat.cast.map((a) => (
          <motion.img
            key={`${beat.scene}-${a.key}`}
            src={a.src}
            alt=""
            className="absolute w-auto drop-shadow-[0_8px_12px_rgba(0,0,0,0.3)]"
            style={{ height: `${a.h}%`, zIndex: a.z ?? 10, scaleX: a.flip ? -1 : 1 }}
            initial={{ opacity: 0, scale: 0.5, left: `${a.anim === "zoom" ? a.left - 30 : a.left}%`, bottom: `${a.anim === "fly" ? a.bottom + 30 : a.bottom}%` }}
            animate={{
              opacity: 1,
              scale: 1,
              left: `${a.anim === "zoom" ? a.left + 30 : a.anim === "fly" ? a.left + 22 : a.left}%`,
              bottom: `${a.bottom}%`,
              y: a.anim === "jump" ? [0, -28, 0] : a.anim === "fly" ? [0, -16, 0] : a.anim === "still" ? 0 : [0, -8, 0],
              rotate: a.anim === "zoom" ? [-4, 4, -4] : a.anim === "fly" ? [-6, 2, -6] : 0,
            }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{
              left: { duration: a.anim === "zoom" || a.anim === "fly" ? (a.dur ?? beat.ms / 1000) : 0.9, ease: a.anim === "zoom" ? "linear" : "easeInOut" },
              bottom: { duration: a.anim === "fly" ? beat.ms / 1000 : 0.9 },
              y: { duration: a.anim === "jump" ? 0.55 : 1.2, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: 0.8, repeat: Infinity },
              opacity: { duration: 0.35 },
              scale: { type: "spring", stiffness: 180, damping: 14 },
            }}
          />
        ))}
      </AnimatePresence>

      {/* comic caption box */}
      <AnimatePresence mode="wait">
        {beat.caption && (
          <motion.div key={`c${i}`} className="comic-caption absolute left-[3%] top-[5%] z-40" initial={{ x: -40, opacity: 0, rotate: -6 }} animate={{ x: 0, opacity: 1, rotate: -2 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}>
            {beat.caption}
          </motion.div>
        )}
      </AnimatePresence>

      {/* speech bubble over whoever's talking */}
      <AnimatePresence mode="wait">
        {beat.bubble && (
          <motion.div
            key={`b${i}`}
            className="comic-bubble absolute z-40"
            style={speaker ? { left: `${Math.min(62, Math.max(beat.caption ? 30 : 2, speaker.left - 2))}%`, bottom: `${Math.min(beat.caption ? 62 : 70, speaker.bottom + speaker.h + 2)}%` } : { left: "40%", bottom: "62%" }}
            initial={{ scale: 0.3, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 17 }}
          >
            {beat.bubble.text}
          </motion.div>
        )}
      </AnimatePresence>

      {beat.notes && <Notes />}

      <AnimatePresence>
        {beat.ribbon && (
          <motion.div key={`r${i}`} className="absolute inset-x-0 bottom-[3%] z-40 flex justify-center" initial={{ scale: 0.3, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.3 }}>
            <div className="carol-ribbon carol-ribbon-lg">{beat.ribbon}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {look.music && (
        <button
          className="absolute bottom-[3%] right-[2%] z-50 rounded-full bg-black/45 px-3 py-1.5 text-sm font-bold text-white"
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
    <div className="flex h-full w-full items-center justify-center overflow-y-auto landscape:flex-row portrait:flex-col" style={{ gap: u(2.4), padding: `${u(1)} ${u(3)} ${u(2)}` }}>
      <Snow />
      <div className="relative flex items-center justify-center landscape:h-full landscape:w-[44%] portrait:w-full portrait:min-h-0 portrait:flex-1" style={{ gap: u(1.6) }}>
        {sheet && (
          <motion.img
            src={sheet}
            alt="Your sticker sheet"
            className="max-h-full w-auto rounded-[12px] bg-white shadow-[0_18px_40px_rgba(80,10,10,0.3)]"
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
