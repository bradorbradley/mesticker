"use client";

/**
 * Screens for a booked event's own booth (/booth/<slug> with a `look`): the hosts as chibi mascots,
 * the event's art and colours, a one-picture reveal, and the welcome video that plays while the
 * sheet prints. The flow underneath is the regular booth's.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import type { PartyEvent } from "@/lib/party-events";
import { u } from "./units";

type Look = NonNullable<PartyEvent["look"]>;

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
 * The welcome video while the sheet prints: the hosts introduce themselves, there's a knock,
 * the door opens, and in walks the guest's own cartoon, greeted by name. Drawn live (no video
 * file), so it's ready the moment printing starts.
 */
export function WelcomeVideo({ event, look, sticker, name }: { event: PartyEvent; look: Look; sticker: string | null; name: string | null }) {
  const lines = [
    ...look.hosts.map((h, i) => ({ who: i, text: i === 0 ? `Hi, I'm ${h.name}!` : i === look.hosts.length - 1 ? `And I'm ${h.name}!` : `I'm ${h.name}!` })),
    { who: 1, text: `Welcome to ${event.name}!` },
    { who: -1, text: "Knock knock! 🚪" },
    { who: 0, text: "Ooh, a new guest! Who is it?" },
  ];
  const BEAT = 2200;
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), BEAT);
    return () => clearInterval(id);
  }, []);
  const beat = Math.min(t, lines.length + 4);
  const knocking = beat === lines.length - 2;
  const doorOpen = beat >= lines.length;
  const arrived = beat >= lines.length;
  const line = beat < lines.length ? lines[beat] : null;
  const hostX = (i: number) => 17 + i * 14; // % from the left, on the rug

  return (
    <div className="carol-scene relative w-full overflow-hidden rounded-[22px] shadow-[0_18px_40px_rgba(80,10,10,0.35)]" style={{ aspectRatio: "16 / 9" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {look.scene ? <img src={look.scene} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-[#7a1a1a]" />}
      <Snow />

      {/* the backdrop's front door (right side): a warm doorway behind a door that swings open */}
      <div className="absolute z-[6] rounded-t-[6px]" style={{ left: "86.4%", top: "24%", width: "13.2%", height: "53.4%", background: "radial-gradient(circle at 50% 40%, #fff3c8, #e9a64b 70%, #8a4b1a)" }} />
      <motion.div
        className="absolute z-[7] origin-left rounded-t-[6px] border-[2px] border-[#5e1010] bg-[#8f1d1d]"
        style={{ left: "86.4%", top: "24%", width: "13.2%", height: "53.4%", transformPerspective: 600 }}
        animate={doorOpen ? { rotateY: -82 } : knocking ? { x: [0, -3, 3, -2, 2, 0] } : {}}
        transition={doorOpen ? { duration: 0.9, ease: "easeOut" } : { duration: 0.45, repeat: knocking ? 3 : 0 }}
      >
        <div className="absolute left-1/2 top-[16%] aspect-square w-[62%] -translate-x-1/2 rounded-full border-[5px] border-[#2f6b3a]" />
        <div className="absolute right-[10%] top-[55%] h-2 w-2 rounded-full bg-[#e8c56b]" />
      </motion.div>

      {/* the guest walks in */}
      <AnimatePresence>
        {arrived && sticker && (
          <motion.img
            key="guest"
            src={sticker}
            alt={name ?? "You"}
            className="absolute bottom-[8%] z-20 h-[56%] w-auto drop-shadow-[0_10px_16px_rgba(0,0,0,0.35)]"
            initial={{ right: "1%", scale: 0.4, opacity: 0 }}
            animate={{ right: beat >= lines.length + 1 ? "11%" : "2%", scale: 1, opacity: 1, y: [0, -14, 0] }}
            transition={{ right: { duration: 1.4 }, scale: { type: "spring", stiffness: 150, damping: 10 }, y: { duration: 0.6, repeat: Infinity } }}
          />
        )}
      </AnimatePresence>

      {/* the hosts */}
      {look.hosts.map((h, i) => (
        <motion.img
          key={h.name}
          src={h.img}
          alt={h.name}
          className="absolute bottom-[6%] z-10 h-[52%] w-auto drop-shadow-[0_8px_12px_rgba(0,0,0,0.3)]"
          style={{ left: `${hostX(i)}%` }}
          initial={{ y: "120%" }}
          animate={{ y: arrived ? [0, -26, 0] : line?.who === i ? [0, -12, 0] : 0 }}
          transition={{ duration: arrived ? 0.55 : 0.6, repeat: arrived || line?.who === i ? Infinity : 0, delay: arrived ? i * 0.12 : 0 }}
        />
      ))}
      {look.cameo && beat >= 2 && (
        <motion.img
          src={look.cameo.img}
          alt={look.cameo.name}
          className="absolute bottom-[4%] left-[1%] z-[8] h-[44%] w-auto"
          initial={{ x: "-120%" }}
          animate={{ x: 0, rotate: [0, -4, 0] }}
          transition={{ x: { duration: 1 }, rotate: { duration: 1.8, repeat: Infinity } }}
        />
      )}

      {/* speech bubble */}
      <AnimatePresence mode="wait">
        {line && (
          <motion.div
            key={beat}
            className="carol-bubble absolute z-30"
            style={line.who >= 0 ? { left: `${hostX(line.who) - 3}%`, bottom: "60%" } : { right: "3%", bottom: "80%" }}
            initial={{ scale: 0.4, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            {line.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* the reveal */}
      <AnimatePresence>
        {arrived && (
          <div className="absolute inset-x-0 top-[5%] z-30 flex justify-center">
            <motion.div initial={{ scale: 0.3, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.5 }}>
              <div className="carol-ribbon carol-ribbon-lg">{name ? `It's ${name}! Welcome!` : "Welcome to the party!"}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
