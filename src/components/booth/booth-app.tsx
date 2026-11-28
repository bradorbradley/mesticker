"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { eventStyleOptions, stylePresets } from "@/lib/presets";
import {
  BOOTH_FREE_MODE,
  BOOTH_FROM_LABEL,
  BOOTH_STYLE,
  SHEET_DESIGNS,
  SHEETS_PER_CASSETTE,
  STICKERS_PER_SHEET,
  bundlePrice,
  getSheet,
  priceLabel,
  type SheetKind,
} from "@/lib/booth-config";
import { addStickerBorder, composePrintSheet, slotPlacement, trimmedAspect } from "@/lib/booth-print";
import { LAYOUTS, SHEET_H, SHEET_W } from "@/lib/sheet-layouts";
import BoothReveal from "./booth-reveal";
import { sounds } from "@/lib/booth-sounds";
import { cn } from "@/lib/utils";
import type { PartyEvent } from "@/lib/party-events";
import GuestSignup, { loadSavedGuest, saveGuest, type SavedGuest } from "@/components/booth/guest-signup";
import { EventAttract, EventReveal, HostsMascot, WelcomeVideo } from "@/components/booth/event-booth";
import Mascot from "./mascot";
import BoothCamera from "./booth-camera";
import OperatorPanel, { IMAGE_MODELS, providersFor, type BoothSettings, type GenStats } from "./operator-panel";
import { u } from "./units";
import LoadingState from "@/components/loading-state";
import { WAIT_GAMES, type WaitGameId } from "./games/wait-games";

type Step = "attract" | "camera" | "generating" | "reveal" | "sheets" | "printing" | "done";

/** The two sets of extra stickers made from the photo. */
type VariantKind = "pose" | "face";
/** 7 extras per set: null = still making, false = failed */
type Variants = Record<VariantKind, (string | null | false)[]>;
/**
 * The event this page is for (/booth/<slug>), set once by BoothApp. Event sheets use their own
 * layout (logo on top, 8 themed poses) and their own artwork.
 */
let ACTIVE_EVENT: PartyEvent | null = null;
const EXTRAS = 7;
const slotsOf = (kind: VariantKind) => Array.from({ length: kind === "pose" && ACTIVE_EVENT?.poses ? ACTIVE_EVENT.poses.length : EXTRAS }, (_, i) => i);
const emptyVariants = (): Variants => ({ pose: slotsOf("pose").map(() => null), face: slotsOf("face").map(() => null) });
const sheetLayout = () => (ACTIVE_EVENT?.look ? ("event11" as const) : ("pack13" as const));
const PILL = "/brand/handle-pill.png";

/** Expressions for the Big Feelings sheet (same pose ideas engine isn't needed). */
const EXPRESSIONS = [
  "laughing out loud, eyes squeezed shut, huge open-mouth smile",
  "winking with a finger-gun and a cheeky grin",
  "heart eyes, hands clasped, totally in love",
  "shocked and surprised, mouth wide open, hands on cheeks",
  "too cool, wearing dark sunglasses, smug smirk, arms crossed",
  "happy tears of joy, crying-laughing",
  "pouty grumpy face, arms crossed, cheeks puffed (cute, not mean)",
];

/** Fallback poses for Pose Party when the per-person ideas take too long. */
const POSES = [
  "big thumbs up with a huge grin",
  "jumping for joy, arms up in the air",
  "peace sign next to the face with a wink",
  "flexing a bicep, proud and confident",
  "waving hello with a big friendly smile",
  "dancing, mid-groove, one arm up",
  "pointing at the viewer, 'you got this' face",
];
const IDEAS_TIMEOUT_MS = 3500;

/**
 * What goes in each of a sheet's 12 slots (pack12 order: hero, 2 beside it,
 * then 3 rows of 3). "main" = their sticker; [kind, i] = extra i of that set.
 * Big slots get the strongest stickers; the small last row repeats favourites.
 */
type Src = "main" | "logo" | "pill" | [VariantKind, number];
const SHEET_RECIPES: Record<SheetKind, Src[]> = {
  pose: ["main", ["pose", 0], ["pose", 1], ["pose", 2], ["pose", 3], ["pose", 4], ["pose", 5], ["pose", 6], "main", ["pose", 0], ["pose", 3], ["pose", 5], "pill"],
  face: ["main", ["face", 0], ["face", 1], ["face", 2], ["face", 3], ["face", 4], ["face", 5], ["face", 6], "main", ["face", 0], ["face", 2], ["face", 4], "pill"],
  best: ["main", ["face", 0], ["pose", 0], ["pose", 1], ["face", 1], ["pose", 2], ["face", 2], ["pose", 3], ["face", 3], ["pose", 4], ["face", 4], "main", "pill"],
};
/** event11: the event logo, the guest, their 8 themed poses, the handle pill */
const EVENT_RECIPE: Src[] = ["logo", "main", ["pose", 0], ["pose", 1], ["pose", 2], ["pose", 3], ["pose", 4], ["pose", 5], ["pose", 6], ["pose", 7], "pill"];

/** Raw sticker per slot: null while an extra is still being made (preview only); failed extras fall back to the main sticker. */
function sheetSources(kind: SheetKind, main: string, variants: Variants, preview: boolean): (string | null)[] {
  const look = ACTIVE_EVENT?.look;
  return (look ? EVENT_RECIPE : SHEET_RECIPES[kind]).map((s) => {
    if (s === "main") return main;
    if (s === "logo") return look?.logo ?? main;
    if (s === "pill") return look?.pill ?? PILL;
    const v = variants[s[0]][s[1]];
    return v ? v : v === null && preview ? null : main;
  });
}

/** One sticker placement for the print station: which sheet, which slot, where (inches from the printable area's top-left). */
export interface KitItem {
  sheet: number; // 0-based, in order of the guest's picks
  n: number; // slot number on that sheet's guide (1–12)
  src: string; // the sticker as it prints: transparent, with its white die-cut border
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bordered copies are slow to make; reuse them between the live preview and printing. */
const borderCache = new Map<string, Promise<string>>();
const bordered = (src: string) => {
  if (!borderCache.has(src)) {
    if (borderCache.size > 60) borderCache.clear();
    borderCache.set(src, addStickerBorder(src));
  }
  return borderCache.get(src)!;
};

/** One sheet exactly as it will print (pending extras drawn as placeholders when previewing). */
async function buildSheet(kind: SheetKind, main: string, variants: Variants, preview: boolean, numbers = false) {
  const srcs = await Promise.all(sheetSources(kind, main, variants, preview).map((s) => (s ? bordered(s) : Promise.resolve(null))));
  return composePrintSheet(srcs, sheetLayout(), { numbers });
}

/** Every sticker placement for the guest's sheets, for the print station. */
async function buildKit(sheets: SheetKind[], main: string, variants: Variants): Promise<KitItem[]> {
  const aspects = new Map<string, Promise<number>>();
  const aspect = (src: string) => {
    if (!aspects.has(src)) aspects.set(src, trimmedAspect(src));
    return aspects.get(src)!;
  };
  const perSheet = await Promise.all(
    sheets.map((kind, sheet) =>
      Promise.all(
        sheetSources(kind, main, variants, false).map(async (raw, i) => {
          const src = await bordered(raw!);
          return { sheet, n: i + 1, src, ...slotPlacement(sheetLayout(), i, await aspect(src)) };
        })
      )
    )
  );
  return perSheet.flat();
}

/** Style examples on the attract screen. */
const BOOTH_STYLES = stylePresets.filter((p) => p.id !== "custom");
const MAX_TRIES = 3; // generations per guest

/** Seconds of no touches before a screen gives up and returns to attract. */
const IDLE_SECONDS: Partial<Record<Step, number>> = {
  camera: 75,
  reveal: 180,
  sheets: 180,
  done: 60,
};

const SETTINGS_KEY = "mesticker-booth-settings";
const today = () => new Date().toISOString().slice(0, 10);

function loadSettings(): BoothSettings {
  const base: BoothSettings = { sheetsLeft: SHEETS_PER_CASSETTE, freeMode: BOOTH_FREE_MODE, salesToday: 0, salesDate: today() };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    const s = { ...base, ...saved };
    return s.salesDate === today() ? s : { ...s, salesToday: 0, salesDate: today() };
  } catch {
    return base;
  }
}

/** Two-panel screen: side by side in landscape, stacked in portrait. */
function Split({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("flex h-full w-full items-center justify-center landscape:flex-row portrait:flex-col", className)}
      style={{ gap: u(3), padding: `0 ${u(4)} ${u(2.5)}` }}
    >
      {children}
    </div>
  );
}

/** Upload an image (data URL) once and get its public URL. */
async function uploadUrl(image: string): Promise<string> {
  const d = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) }).then((r) => r.json());
  if (!d.url) throw new Error("upload failed");
  return d.url as string;
}

export default function BoothApp({ event }: { event?: PartyEvent } = {}) {
  ACTIVE_EVENT = event ?? null;
  // event links (/booth/<slug>): same booth, free, event theme. Guests sign up when they scan a QR on their
  // phone: here when the booth's "use your phone" QR opened this page (?qr=1), or via /booth/snap and /booth/get.
  const eventSlug = useRef(event?.slug ?? null);
  const [fromQr, setFromQr] = useState(false);
  useEffect(() => {
    const qr = new URLSearchParams(location.search).get("qr") === "1";
    setFromQr(qr);
    fromQrRef.current = qr;
    if (qr && eventSlug.current) setGuest(loadSavedGuest(eventSlug.current));
  }, []);
  const [guest, setGuest] = useState<SavedGuest | null>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const guestRef = useRef(guest);
  guestRef.current = guest;
  const fromQrRef = useRef(false);
  /** event looks: sign-up comes right before printing, then the print starts */
  const printAfterSignup = useRef(false);
  const photoUrl = useRef<Promise<string | null> | null>(null);
  const collectGuest = useRef(!!event?.collectGuest);
  const [step, setStep] = useState<Step>("attract");
  const [photo, setPhoto] = useState<string | null>(null);
  const [sticker, setSticker] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [, setError] = useState<string | null>(null);
  const [lastGen, setLastGen] = useState<GenStats | null>(null);
  // numbered guide per picked sheet, shown while printing
  const [guides, setGuides] = useState<string[] | null>(null);
  const [kit, setKit] = useState<KitItem[] | null>(null);
  // one id per paid order, so reopening the kit never queues it twice
  const [printOrder, setPrintOrder] = useState<PrintOrder | null>(null);
  const [digitalUrl, setDigitalUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<BoothSettings | null>(null);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  // Sticker is done but the guest is mid-game: the "It's ready!" takeover plays first.
  const [stickerReady, setStickerReady] = useState(false);
  // the guest's cart: which of the three sheets (1–3)
  const [picked, setPicked] = useState<SheetKind[]>(["pose"]);
  const [emailOn, setEmailOn] = useState(false);
  const [autoEmailedTo, setAutoEmailedTo] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/booth/send")
      .then((r) => r.json())
      .then((d) => setEmailOn(!!d.email))
      .catch(() => {});
  }, []);

  // ---- Pose / Mix packs: 8 extra stickers, started the moment the photo is taken
  const [variants, setVariantsState] = useState<Variants>(emptyVariants);
  const variantsRef = useRef<Variants>(emptyVariants());
  const genId = useRef(0);
  const setVariant = (kind: VariantKind, i: number, v: string | false, id: number) => {
    if (id !== genId.current) return; // a newer photo/style replaced this one
    const next = { ...variantsRef.current, [kind]: variantsRef.current[kind].map((x, j) => (j === i ? v : x)) };
    variantsRef.current = next;
    setVariantsState(next);
  };
  const resetVariants = () => {
    genId.current += 1;
    variantJobs.current = {};
    ideasJob.current = null;
    variantPhoto.current = null;
    variantsRef.current = emptyVariants();
    setVariantsState(variantsRef.current);
  };

  useEffect(() => {
    const s = loadSettings();
    // /booth?model=nano|mixed|openai|default picks the image model for this laptop (remembered)
    const m = new URLSearchParams(location.search).get("model");
    if (m && IMAGE_MODELS.some((x) => x.id === m)) {
      s.imageModel = m as BoothSettings["imageModel"];
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      } catch {}
    }
    setSettings(s);
  }, []);
  // the staff panel's image model, read when a request goes out (generate() is a stable callback)
  const modelRef = useRef(providersFor(undefined));
  modelRef.current = providersFor(settings?.imageModel);
  // the event's cartoon style, from the staff panel (default chibi)
  const styleRef = useRef(BOOTH_STYLE);
  const themeRef = useRef<string | undefined>(undefined);
  themeRef.current = event?.theme || settings?.eventTheme || undefined;
  styleRef.current = event?.style ? event.style : settings?.eventStyle && eventStyleOptions.some((p) => p.id === settings.eventStyle) ? settings.eventStyle : BOOTH_STYLE;
  const updateSettings = useCallback((patch: Partial<BoothSettings>) => {
    setSettings((s) => {
      const next = { ...(s ?? loadSettings()), ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setStep("attract");
    setPhoto(null);
    setSticker(null);
    setTries(0);
    setError(null);
    setGuides(null);
    setKit(null);
    setPrintOrder(null);
    setDigitalUrl(null);
    setPaid(false);
    setStickerReady(false);
    setPicked(["pose"]);
    setAutoEmailedTo(null);
    photoUrl.current = null;
    setSignupOpen(false);
    printAfterSignup.current = false;
    if (!fromQrRef.current) setGuest(null);
    resetVariants();
    setOperatorOpen(false);
    printCopy.current = null;
  }, []);

  // ---- idle reset
  const lastTouch = useRef(Date.now());
  useEffect(() => {
    const touch = () => (lastTouch.current = Date.now());
    window.addEventListener("pointerdown", touch);
    return () => window.removeEventListener("pointerdown", touch);
  }, []);
  useEffect(() => {
    lastTouch.current = Date.now();
    const limit = IDLE_SECONDS[step];
    if (!limit || operatorOpen) return;
    const id = setInterval(() => {
      if (Date.now() - lastTouch.current > limit * 1000) reset();
    }, 1000);
    return () => clearInterval(id);
  }, [step, operatorOpen, reset]);

  // ---- generation
  // The guest waits only for a fast preview; a sharper print copy is made in
  // the background while they look and pay, and printing uses it if ready.
  const printCopy = useRef<Promise<string | null> | null>(null);
  const startPrintCopy = (image: string, resolvedStyle: string) => {
    printCopy.current = fetch("/api/booth/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, styleId: resolvedStyle, tier: "print", provider: modelRef.current.hero, theme: themeRef.current }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.generatedImage as string | undefined) ?? null)
      .catch(() => null);
  };

  /** Bordered sticker → public URL for the guest's phone (QR / email). */
  const uploadDigital = (img: string) =>
    addStickerBorder(img)
      .then((bordered) =>
        fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: bordered }),
        })
      )
      .then((r) => r.json())
      .then((d) => {
        if (d.url) setDigitalUrl(d.url);
        return (d.url as string | undefined) ?? null;
      })
      .catch(() => null);

  /**
   * Make the 14 extra stickers from the original photo, in parallel with the
   * main one (all chibi): "pose" = 7 poses designed for this person by the
   * vision engine, "face" = 7 expressions. Both start at capture so all three
   * sheets fill in during the reveal. Each request retries once.
   */
  const ideasJob = useRef<Promise<string[]> | null>(null);
  const variantPhoto = useRef<string | null>(null);
  const variantJobs = useRef<Partial<Record<VariantKind, Promise<unknown>>>>({});
  const startVariants = (kind: VariantKind) => {
    const image = variantPhoto.current;
    if (!image || variantJobs.current[kind]) return;
    const id = genId.current;
    const post = (body: object) =>
      fetch("/api/booth/pose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, provider: modelRef.current.extras }) }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
      );
    const retry = <T,>(fn: () => Promise<T>) => fn().catch(() => new Promise<T>((ok, no) => setTimeout(() => fn().then(ok, no), 3000)));
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const ideas: Promise<string[]> =
      kind === "face"
        ? Promise.resolve(EXPRESSIONS)
        : ACTIVE_EVENT?.poses
          ? Promise.resolve(ACTIVE_EVENT.poses)
          : (ideasJob.current ??= Promise.race([
            // poses designed for this person, if the vision engine answers quickly; otherwise the stock poses, so Pose Party doesn't lag
            post({ photo: image }).then((d: { ideas: string[] }) => (d.ideas?.length ? d.ideas : POSES)),
            new Promise<string[]>((r) => setTimeout(() => r(POSES), IDEAS_TIMEOUT_MS)),
          ]).catch(() => POSES));
    variantJobs.current[kind] = ideas
      .then((list) =>
        // stagger so 14 image requests don't all land in the same instant
        Promise.allSettled(
          slotsOf(kind).map((i) =>
            wait(i * 350 + (kind === "face" ? 175 : 0))
              .then(() => retry(() => post({ photo: image, styleId: styleRef.current, idea: list[i % list.length], theme: themeRef.current })))
              .then((d) => setVariant(kind, i, d.image, id))
              .catch(() => setVariant(kind, i, false, id))
          )
        )
      )
      .catch(() => slotsOf(kind).forEach((i) => variantsRef.current[kind][i] === null && setVariant(kind, i, false, id)));
  };

  const startVariantsRef = useRef(startVariants);
  startVariantsRef.current = startVariants;

  const generate = useCallback(async (image: string) => {
    printCopy.current = null;
    resetVariants();
    setStickerReady(false);
    setStep("generating");
    setError(null);
    setSticker(null);
    setGuides(null);
    setTries((t) => t + 1);
    // main sticker first, then the 14 sheet stickers right behind it
    const main = fetch("/api/booth/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, styleId: styleRef.current, provider: modelRef.current.hero, theme: themeRef.current }),
    });
    variantPhoto.current = image;
    if (collectGuest.current) photoUrl.current = uploadUrl(image).catch(() => null);
    startVariantsRef.current("pose");
    if (!ACTIVE_EVENT?.look) startVariantsRef.current("face");
    try {
      const res = await main;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSticker(data.generatedImage);
      setLastGen({ provider: data.provider, model: data.model, ms: data.ms });
      startPrintCopy(image, data.stylePreset);
      try {
        localStorage.setItem("mesticker-booth-gen-ms", String(data.ms));
      } catch {}
      setStickerReady(true);
      setStep("sheets");
      sounds.success();
      uploadDigital(data.generatedImage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("reveal");
    }
  }, []);

  // ---- printing: build the sheets, hand them to the print station, send the digital copy
  /**
   * The print files for these sheets: the sharp main sticker (≤30s wait), the
   * extras (≤60s for stragglers; any that failed print as the main sticker),
   * a numbered guide per sheet and every sticker's placement.
   */
  const buildPrintFiles = useCallback(
    async (sheets: SheetKind[], quick = false) => {
      if (!sticker) throw new Error("no sticker");
      const pending = printCopy.current;
      const hq = pending && !quick ? await Promise.race([pending, new Promise<null>((r) => setTimeout(() => r(null), 30000))]) : null;
      const main = hq || sticker;
      const needs = new Set<VariantKind>(sheets.flatMap((k) => (k === "best" ? ["pose", "face"] : [k])) as VariantKind[]);
      // quick: whatever's drawn right now (the full kit follows); otherwise wait up to 60 s for stragglers
      if (!quick) await Promise.race([Promise.all([...needs].map((k) => variantJobs.current[k])), new Promise((r) => setTimeout(r, 60000))]);
      const v = variantsRef.current;
      const sheetGuides = await Promise.all(sheets.map((k) => buildSheet(k, main, v, false, true)));
      return { main, guides: sheetGuides, kit: await buildKit(sheets, main, v) };
    },
    [sticker]
  );

  /**
   * As soon as a Stripe checkout exists, send the complete order to the print
   * queue (unpaid). The server checks Stripe itself, so the order prints once
   * paid even if this tab never sees the payment (a phone paying in another
   * tab pauses this one).
   */
  const prepared = useRef<{ checkoutId: string; orderId: string } | null>(null);
  const prepareOrder = useCallback(
    async (checkoutId: string) => {
      if (!sticker || !picked.length) return;
      const sheets = picked;
      const orderId = newOrderId();
      prepared.current = { checkoutId, orderId };
      const order = { id: orderId, sheets, checkoutId };
      // 1) right away, with what's drawn so far, so Pay is ready in a few seconds (the station
      //    fills any gaps if this tab gets paused while paying on the same phone) ...
      const quick = await buildPrintFiles(sheets, true);
      await sendKit(quick.guides, quick.kit, order);
      // 2) ... then the full kit, same order, once every sheet sticker is drawn
      buildPrintFiles(sheets)
        .then((full) => prepared.current?.orderId === orderId && sendKit(full.guides, full.kit, order))
        .catch((e) => console.error("full kit resend failed", e));
    },
    [sticker, picked, buildPrintFiles]
  );

  const startPrint = useCallback(
    async (checkoutId?: string) => {
      if (!sticker || !picked.length) return;
      const sheets = picked;
      setPaid(true);
      // same order id as the one already sent unpaid, so it's one order, now paid
      const orderId = checkoutId && prepared.current?.checkoutId === checkoutId ? prepared.current.orderId : newOrderId();
      setPrintOrder({ id: orderId, sheets, checkoutId: checkoutId ?? null });
      setStep("printing");
      try {
        const { main, guides: sheetGuides, kit: sheetKit } = await buildPrintFiles(sheets);
        if (event?.collectGuest) {
          // saved for the guest to claim from their phone: original photo, main sticker, clean sheets (no numbers)
          const v = variantsRef.current;
          const [photo, stickerUrl, sheetUrls] = await Promise.all([
            photoUrl.current ?? Promise.resolve(null),
            uploadUrl(await addStickerBorder(main)).catch(() => null),
            Promise.all(sheets.map(async (k) => uploadUrl(await buildSheet(k, main, v, false, false)).catch(() => null))),
          ]);
          setPrintOrder({
            id: orderId,
            sheets,
            checkoutId: checkoutId ?? null,
            event: event.slug,
            ...(guestRef.current ? { guest: { id: guestRef.current.id, token: guestRef.current.token } } : {}),
            photoUrl: photo,
            stickerUrl,
            sheetUrls: sheetUrls.filter((u): u is string => !!u),
          });
          const guest = guestRef.current;
          if (guest) {
            const [user, domain] = guest.email.split("@");
            setAutoEmailedTo(`${user.slice(0, 2)}•••@${domain}`);
          }
        }
        setGuides(sheetGuides);
        setKit(sheetKit);
        setSettings((s) => {
          if (!s) return s;
          const next = { ...s, sheetsLeft: Math.max(0, s.sheetsLeft - sheets.length), salesToday: s.salesToday + 1 };
          try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
        // the sharp copy replaces the preview for the phone QR, then email it to whoever paid
        const url = await uploadDigital(main);
        if (url && checkoutId && emailOn) {
          fetch("/api/booth/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: url, sessionId: checkoutId }),
          })
            .then((r) => r.json())
            .then((d) => d.sent && setAutoEmailedTo(d.to))
            .catch(() => {});
        }
      } catch (e) {
        console.error("print file failed", e);
      }
    },
    [sticker, picked, emailOn, buildPrintFiles, event]
  );

  const outOfPaper = settings !== null && settings.sheetsLeft <= 0;
  // the admin page's event switch (server) or this device's staff panel
  const [eventFree, setEventFree] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/booth/event", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => alive && setEventFree(d.free === true))
        .catch(() => {});
    check();
    const t = setInterval(check, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const freeMode = !!event?.free || eventFree || (settings?.freeMode ?? BOOTH_FREE_MODE);

  // ---- "Take from mobile": the guest's phone takes the photo, then either device picks sheets / pays.
  // This laptop stays the brain (it makes the stickers and sends the print order); the phone
  // follows through /api/booth/pair. Both poll every 1.5 s.
  // a real phone (not an iPad in portrait): no "take from mobile" QR on the device that IS the phone
  const handset = useIsHandset();
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairQr, setPairQr] = useState<string | null>(null);
  const [pairOpen, setPairOpen] = useState(false);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [payShare, setPayShare] = useState<{ url: string; payFor: string } | null>(null);
  const pairSeen = useRef({ photoAt: "", seq: 0, print: 0, startedAt: 0 });
  const stepRef = useRef(step);
  stepRef.current = step;
  const phonePrintRef = useRef<() => void>(() => {});
  phonePrintRef.current = () => {
    if (freeMode && stepRef.current === "sheets" && !paid && picked.length) startPrint();
  };

  const startPairing = useCallback(() => {
    sounds.tap();
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join("");
    const code = rand + Date.now().toString(36).slice(-4);
    pairSeen.current = { photoAt: "", seq: 0, print: 0, startedAt: Date.now() };
    setPairCode(code);
    setPhoneConnected(false);
    setPayShare(null);
    setPairQr(null);
    setPairOpen(true);
    QRCode.toDataURL(`${location.origin}/booth/snap?p=${code}${eventSlug.current ? `&e=${eventSlug.current}` : ""}`, { width: 520, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } })
      .then(setPairQr)
      .catch(() => {});
  }, []);

  const onPayUrl = useCallback((url: string | null, sheets: SheetKind[]) => {
    const key = sheets.join("+");
    setPayShare((cur) => (url ? { url, payFor: key } : cur?.payFor === key ? null : cur));
  }, []);

  // follow the phone: its photo, sheet changes, free-mode print
  useEffect(() => {
    if (!pairCode) return;
    let alive = true;
    const tick = async () => {
      try {
        const d = await (await fetch(`/api/booth/pair?p=${pairCode}`, { cache: "no-store" })).json();
        if (!alive) return;
        if (d.connectedAt) {
          setPhoneConnected(true);
          // the guest is busy on their phone: don't idle-reset the booth under them (for up to 10 min)
          if (Date.now() - pairSeen.current.startedAt < 10 * 60_000) lastTouch.current = Date.now();
        }
        if (d.photoAt && d.photoAt !== pairSeen.current.photoAt) {
          pairSeen.current.photoAt = d.photoAt;
          if (stepRef.current === "camera" || stepRef.current === "attract") {
            const { photo } = await (await fetch(`/api/booth/pair?p=${pairCode}&photo=1`, { cache: "no-store" })).json();
            if (alive && photo) {
              setPairOpen(false);
              sounds.success();
              setPhoto(photo);
              generate(photo);
            }
          }
        }
        const ph = d.phone ?? {};
        if (ph.seq && ph.seq > pairSeen.current.seq) {
          pairSeen.current.seq = ph.seq;
          if (Array.isArray(ph.picked) && ph.picked.length) setPicked(ph.picked as SheetKind[]);
        }
        if (ph.print && ph.print > pairSeen.current.print) {
          pairSeen.current.print = ph.print;
          phonePrintRef.current();
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pairCode, generate]);

  // tell the phone what this screen shows
  const pairPayUrl = payShare && payShare.payFor === picked.join("+") ? payShare.url : null;
  useEffect(() => {
    if (!pairCode) return;
    const state = { step, picked, sticker: digitalUrl, payUrl: pairPayUrl, payFor: pairPayUrl ? picked.join("+") : null, freeMode, paid, event: event?.slug ?? null, orderId: printOrder?.id ?? null };
    const t = setTimeout(() => {
      fetch("/api/booth/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p: pairCode, role: "laptop", state }) }).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [pairCode, step, picked, digitalUrl, pairPayUrl, freeMode, paid, event?.slug, printOrder?.id]);

  // a new guest (reset / idle): end the pairing and tell the old phone
  const pairCodeRef = useRef(pairCode);
  pairCodeRef.current = pairCode;
  useEffect(() => {
    if (step !== "attract" || !pairCodeRef.current) return;
    const code = pairCodeRef.current;
    fetch("/api/booth/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p: code, role: "laptop", state: { step: "attract", picked: [], sticker: null, payUrl: null, payFor: null, freeMode, paid: false } }),
    }).catch(() => {});
    setPairCode(null);
    setPairOpen(false);
    setPayShare(null);
    setPhoneConnected(false);
  }, [step, freeMode]);

  return (
    <div className={cn("booth fixed inset-0 z-40 flex flex-col overflow-hidden", event?.look?.themeClass)}>
      <TopBar
        step={step}
        canJump={(s) =>
          step !== "generating" && step !== "printing" && step !== "done" && step !== s &&
          (s === "camera" || (s === "sheets" && !!sticker))
        }
        onJump={(s) => {
          sounds.tap();
          if (s === "camera") setPhoto(null);
          setStep(s);
        }}
        onSecret={() => setOperatorOpen(true)}
        onHome={step !== "attract" && step !== "printing" ? reset : undefined}
      />

      <main className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25 }}
          >
            {step === "attract" && event?.look && (
              <EventAttract
                event={event}
                look={event.look}
                outOfPaper={outOfPaper}
                phone={handset}
                qrPath={`/booth/${event.slug}?qr=1`}
                onStart={() => {
                  sounds.unlock();
                  sounds.tap();
                  document.documentElement.requestFullscreen?.().catch(() => {});
                  setStep("camera");
                }}
              />
            )}
            {step === "attract" && !event?.look && (
              <Attract
                outOfPaper={outOfPaper}
                freeMode={freeMode}
                qrPath={event ? `/booth/${event.slug}?qr=1` : undefined}
                onStart={() => {
                  sounds.unlock();
                  sounds.tap();
                  document.documentElement.requestFullscreen?.().catch(() => {});
                  if (event?.collectGuest && fromQr && !guest) setSignupOpen(true);
                  else setStep("camera");
                }}
              />
            )}
            {step === "camera" && (
              <BoothCamera
                onBack={() => setStep("attract")}
                onCapture={(p) => {
                  setPairOpen(false);
                  setPhoto(p);
                  generate(p);
                }}
                onMobile={handset ? undefined : startPairing}
                mascot={event?.look ? <HostsMascot look={event.look} style={{ height: u(20) }} className="self-start short:hidden portrait:hidden" /> : undefined}
              />
            )}
            {step === "generating" && <Generating photo={photo} ready={stickerReady} />}
            {step === "reveal" && (
              <Reveal
                canRetry={tries < MAX_TRIES}
                onRetry={() => (photo ? generate(photo) : setStep("camera"))}
                onRetake={() => {
                  setPhoto(null);
                  setStep("camera");
                }}
              />
            )}
            {step === "sheets" && sticker && event?.look && (
              <EventReveal
                sticker={sticker}
                canRetry={tries < MAX_TRIES}
                onRetry={() => photo && generate(photo)}
                onRetake={() => {
                  setPhoto(null);
                  setStep("camera");
                }}
                onPrint={() => {
                  sounds.tap();
                  if (event.collectGuest && !guest) {
                    printAfterSignup.current = true;
                    setSignupOpen(true);
                  } else startPrint();
                }}
              />
            )}
            {step === "sheets" && sticker && !event?.look && (
              <SheetShop
                photo={photo}
                sticker={sticker}
                variants={variants}
                picked={picked}
                freeMode={freeMode}
                sheetsLeft={settings?.sheetsLeft ?? SHEETS_PER_CASSETTE}
                onToggle={(id) => {
                  sounds.tap();
                  setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : SHEET_DESIGNS.map((d) => d.id).filter((x) => x === id || p.includes(x))));
                }}
                canRetry={tries < MAX_TRIES}
                onRetry={() => photo && generate(photo)}
                onRetake={() => {
                  setPhoto(null);
                  setStep("camera");
                }}
                onPaid={startPrint}
                onCheckout={prepareOrder}
                onPayUrl={pairCode ? onPayUrl : undefined}
              />
            )}
            {step === "printing" && (
              <PrintKit
                guides={guides}
                kit={kit}
                order={printOrder}
                onDone={() => setStep("done")}
                waitWith={event?.look ? (status) => <EventWait video={<WelcomeVideo event={event} look={event.look!} sticker={digitalUrl ?? sticker} name={guest?.name ?? null} />} status={status} /> : undefined}
              />
            )}
            {step === "done" && <Done sticker={sticker} digitalUrl={digitalUrl} emailOn={emailOn} autoEmailedTo={autoEmailedTo} onFinish={reset} claim={event?.collectGuest && printOrder ? { event: event.slug, orderId: printOrder.id } : null} />}
          </motion.div>
        </AnimatePresence>
        {signupOpen && event && (
          <GuestSignup
            event={event}
            onCancel={() => setSignupOpen(false)}
            onDone={(g) => {
              setGuest(g);
              guestRef.current = g;
              if (fromQrRef.current) saveGuest(event.slug, g);
              setSignupOpen(false);
              if (printAfterSignup.current) {
                printAfterSignup.current = false;
                startPrint();
              } else setStep("camera");
            }}
          />
        )}
      </main>

      {pairOpen && step === "camera" && (
        <PhonePairOverlay qr={pairQr} connected={phoneConnected} onClose={() => setPairOpen(false)} />
      )}
      {pairCode && phoneConnected && !pairOpen && (step === "generating" || step === "sheets" || step === "reveal") && (
        <div className="t-body pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1 shadow">
          📱 Phone connected: pick sheets or pay on either screen
        </div>
      )}

      {operatorOpen && settings && (
        <OperatorPanel
          settings={settings}
          update={updateSettings}
          lastGen={lastGen}
          canReprint={!!kit && step === "done"}
          canMarkPaid={(step === "reveal" || step === "sheets") && !!sticker && !paid && picked.length > 0}
          onReprint={() => kit && setStep("printing")}
          onMarkPaid={() => {
            setOperatorOpen(false);
            startPrint();
          }}
          onReset={reset}
          onClose={() => setOperatorOpen(false)}
        />
      )}
    </div>
  );
}

// ================================================================ take from mobile

/** QR for the guest's phone: snap a selfie or pick a photo there, the stickers appear here. */
function PhonePairOverlay({ qr, connected, onClose }: { qr: string | null; connected: boolean; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,26,46,0.55)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <motion.div
        className="card flex items-center bg-white landscape:flex-row portrait:flex-col"
        style={{ gap: u(3), padding: u(3), maxWidth: "92vw" }}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex aspect-square shrink-0 items-center justify-center bg-white" style={{ width: `clamp(200px, ${u(30)}, 70vw)` }}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Scan with your phone" className="h-full w-full" />
          ) : (
            <motion.span style={{ fontSize: u(5) }} animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              ✨
            </motion.span>
          )}
        </div>
        <div className="flex max-w-md flex-col" style={{ gap: u(1.2) }}>
          <h2 className="t-h2">
            Use your <span className="pop">phone</span>
          </h2>
          <ol className="t-lead" style={{ display: "grid", gap: u(0.6) }}>
            <li>1. Scan with your phone camera</li>
            <li>2. Snap a selfie or pick a photo</li>
            <li>3. Your stickers appear right here. Pick sheets and pay on your phone or this screen</li>
          </ol>
          {connected ? (
            <motion.div className="t-lead font-bold text-[#15803d]" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.6, repeat: Infinity }}>
              📱 Phone connected: waiting for your photo…
            </motion.div>
          ) : (
            <div className="t-body opacity-70">Waiting for your phone…</div>
          )}
          <button className="btn btn-soft w-fit" onClick={onClose}>
            ← Use this camera instead
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ================================================================ top bar

const STEP_LABELS: { label: string; target: Step; steps: Step[] }[] = [
  { label: "Snap", target: "camera", steps: ["camera"] },
  { label: "Your stickers", target: "sheets", steps: ["generating", "reveal", "sheets"] },
  { label: "Print", target: "printing", steps: ["printing", "done"] },
];

function TopBar({
  step,
  canJump,
  onJump,
  onSecret,
  onHome,
}: {
  step: Step;
  canJump: (s: Step) => boolean;
  onJump: (s: Step) => void;
  onSecret: () => void;
  onHome?: () => void;
}) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = STEP_LABELS.findIndex((s) => s.steps.includes(step));
  return (
    <header className="flex shrink-0 items-center justify-between" style={{ height: `max(56px, ${u(6.5)})`, padding: `0 ${u(3)}`, gap: u(1.5) }}>
      <div
        className="font-fun shrink-0 font-bold"
        style={{ fontSize: `max(17px, ${u(2.6)})` }}
        onPointerDown={() => (hold.current = setTimeout(onSecret, 2000))}
        onPointerUp={() => hold.current && clearTimeout(hold.current)}
        onPointerLeave={() => hold.current && clearTimeout(hold.current)}
        onContextMenu={(e) => e.preventDefault()}
      >
        Me<span className="pop">Sticker</span>
      </div>

      {current >= 0 && (
        <ol className="flex min-w-0 items-center" style={{ gap: u(0.6) }}>
          {STEP_LABELS.map((s, i) => {
            const jumpable = i !== current && canJump(s.target);
            return (
              <li key={s.label}>
                <button
                  disabled={!jumpable}
                  onClick={() => onJump(s.target)}
                  className={cn(
                    "chip flex min-h-[36px] items-center transition-colors",
                    i === current
                      ? "bg-[var(--purple)] text-white"
                      : jumpable
                        ? "bg-[#dcfce7] text-[#15803d] active:scale-95"
                        : i < current
                          ? "bg-[#dcfce7] text-[#15803d]"
                          : "bg-white/50 text-[#a8a4bd]"
                  )}
                  style={{ gap: u(0.5) }}
                >
                  <span>{i < current ? "✓" : i + 1}</span>
                  <span className={cn(i !== current && "max-[700px]:hidden")}>{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex shrink-0 justify-end" style={{ minWidth: u(10) }}>
        {onHome && (
          <button className="btn btn-soft" onClick={onHome}>
            ↺ <span className="max-[700px]:hidden">Start over</span>
          </button>
        )}
      </div>
    </header>
  );
}

// ================================================================ attract

const FLOATERS = ["⭐", "💖", "🌈", "⚡"];
// Corners and edges only, so they never sit on top of text.
const FLOATER_SPOTS: React.CSSProperties[] = [
  { left: "1%", top: "1%" },
  { right: "1%", top: "1%" },
  { left: "1%", bottom: "1%" },
  { right: "1%", bottom: "1%" },
];

function Attract({ onStart, outOfPaper, freeMode, qrPath = "/booth" }: { onStart: () => void; outOfPaper: boolean; freeMode: boolean; qrPath?: string }) {
  // on the booth laptop: a QR so guests can do the whole thing on their own phone (orders still print here)
  const phone = useIsPhone();
  const [phoneQr, setPhoneQr] = useState<string | null>(null);
  useEffect(() => {
    if (phone) return;
    QRCode.toDataURL(`${location.origin}${qrPath}`, { width: 360, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } })
      .then(setPhoneQr)
      .catch(() => {});
  }, [phone, qrPath]);
  // the bottom-right example makes room for the phone QR
  const examples = BOOTH_STYLES.filter((s) => s.id !== "random").slice(0, phone ? 4 : 3);
  const spots = [
    { left: "2%", top: "4%", rotate: -12 },
    { right: "2%", top: "0%", rotate: 10 },
    { left: "0%", bottom: "6%", rotate: 8 },
    { right: "4%", bottom: "2%", rotate: -8 },
  ];
  return (
    <button className="relative h-full w-full text-left" onClick={onStart} disabled={outOfPaper}>
      {FLOATERS.map((e, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute opacity-70"
          style={{ fontSize: u(2.2), ...FLOATER_SPOTS[i] }}
          animate={{ y: [0, -14, 0], rotate: [0, 15, 0] }}
          transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
        >
          {e}
        </motion.span>
      ))}

      <Split>
        <div className="flex flex-col landscape:w-[50%] portrait:items-center portrait:text-center" style={{ gap: u(2) }}>
          <motion.span
            className="chip w-fit bg-[var(--yellow)] text-[var(--ink)]"
            animate={{ rotate: [-3, 3, -3] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          >
            {freeMode ? "🎉 Free today!" : `Stickers from ${BOOTH_FROM_LABEL} · ready in 2 min`}
          </motion.span>
          <h1 className="t-hero">
            Turn yourself into a <span className="pop">sticker!</span>
          </h1>
          <p className="t-lead max-w-[30ch]">Snap a pic, pick your sticker sheets, and peel off real stickers printed right here.</p>

          {outOfPaper ? (
            <div className="t-h3 card w-fit" style={{ padding: `${u(1.2)} ${u(2.4)}` }}>
              🧻 Out of stickers — back in a minute!
            </div>
          ) : (
            <motion.div
              className="btn btn-lg btn-main w-fit"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              Tap to start ✨
            </motion.div>
          )}

          <ol className="flex flex-wrap short:hidden portrait:justify-center" style={{ gap: `${u(0.8)} ${u(1.6)}` }}>
            {["Snap a pic", "Pick your sheets", "Pay by phone", "Peel & stick"].map((t, i) => (
              <li key={t} className="t-body flex items-center" style={{ gap: u(0.6) }}>
                <span
                  className="font-fun flex items-center justify-center rounded-full bg-white font-bold text-[var(--purple)] shadow"
                  style={{ width: `max(24px, ${u(2.4)})`, height: `max(24px, ${u(2.4)})` }}
                >
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
          <p className="t-body max-w-[46ch] opacity-70 short:hidden" style={{ fontSize: `max(11px, ${u(0.95)})` }}>
            By taking a photo you agree to our Terms and Privacy Policy at mesticker.fun. Photos are turned into cartoons by AI services, never used
            for facial recognition, and deleted within 14 days.
          </p>
        </div>

        <div className="relative flex items-center justify-center landscape:h-full landscape:flex-1 portrait:w-full portrait:min-h-0 portrait:flex-1">
          {examples.map((s, i) => (
            <motion.div
              key={s.id}
              className="card absolute overflow-hidden"
              style={{ ...spots[i], width: u(11), rotate: spots[i].rotate, padding: u(0.4) }}
              animate={{ y: [0, i % 2 ? 10 : -10, 0] }}
              transition={{ duration: 2.8 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.previewImage} alt={s.name} className="aspect-square w-full object-cover" style={{ borderRadius: u(1.4) }} />
            </motion.div>
          ))}
          <Mascot className="relative z-10 h-[80%] max-h-full" mood="idle" />
          {phoneQr && !phone && !outOfPaper && (
            <div className="card absolute bottom-[4%] right-[2%] z-20 flex items-center short:hidden" style={{ gap: u(1), padding: u(1) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={phoneQr} alt="Scan to use your phone" className="shrink-0 bg-white" style={{ width: `max(96px, ${u(11)})`, height: `max(96px, ${u(11)})` }} />
              <div style={{ maxWidth: "11em" }}>
                <div className="t-h3">📱 Use your phone</div>
                <div className="t-body">Scan to snap and pick your sheets on your own phone. It prints right here.</div>
              </div>
            </div>
          )}
        </div>
      </Split>
    </button>
  );
}

// ================================================================ generating

function Generating({ photo, ready }: { photo: string | null; ready: boolean }) {
  // ~10–20 s: the web app's loading animation and countdown, nothing else to compete with it
  return (
    <div className="flex h-full w-full flex-col items-center justify-center" style={{ gap: u(1), padding: u(2) }}>
      <LoadingState photo={photo} className="!py-2" />
      {ready && <span className="t-h3">🎉 Ready!</span>}
    </div>
  );
}

/**
 * Snap's mini-games with a status panel beside them (laptop) or above them
 * (phone). Used while the sheet prints.
 */
function PlayWhileYouWait({ status }: { status: React.ReactNode }) {
  const [game, setGame] = useState<WaitGameId>(() => WAIT_GAMES[Math.floor(Math.random() * WAIT_GAMES.length)].id);
  const Game = WAIT_GAMES.find((g) => g.id === game)!.Comp;
  const tabs = (
    <nav className="flex flex-wrap justify-center" style={{ gap: u(0.5) }}>
      {WAIT_GAMES.map((g) => (
        <button
          key={g.id}
          className={cn("chip min-h-[36px] whitespace-nowrap", g.id === game ? "bg-[var(--purple)] text-white" : "bg-[var(--lav)] text-[var(--ink)]")}
          onClick={() => {
            sounds.tap();
            setGame(g.id);
          }}
        >
          <span className="max-[700px]:hidden">{g.label}</span>
          <span className="min-[701px]:hidden">{g.short}</span>
        </button>
      ))}
    </nav>
  );
  return (
    <div className="relative flex h-full w-full flex-col landscape:flex-row short:!flex-col" style={{ padding: `0 ${u(3)} ${u(1)}`, gap: u(1) }}>
      <div className="card flex shrink-0 flex-col landscape:w-[32%] landscape:justify-center short:!w-full" style={{ padding: u(1.2), gap: u(1) }}>
        {status}
        <div className="t-body text-center short:hidden">Play a game while it prints 👇</div>
        {tabs}
      </div>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={game} className="absolute inset-0" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Game />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ================================================================ reveal

function Reveal({ canRetry, onRetry, onRetake }: { canRetry: boolean; onRetry: () => void; onRetake: () => void }) {
  return (
    <Split>
      <div className="flex items-center justify-center landscape:h-full landscape:w-[36%] portrait:w-full portrait:min-h-0 portrait:flex-1">
        {ACTIVE_EVENT?.look ? <HostsMascot look={ACTIVE_EVENT.look} className="h-[60%] max-h-full w-full" /> : <Mascot className="h-[75%] max-h-full" />}
      </div>
      <div className="flex flex-col landscape:w-[48%] portrait:items-center portrait:text-center" style={{ gap: u(2) }}>
        <h2 className="t-h2">
          Oops! That one <span className="pop">didn&apos;t develop.</span>
        </h2>
        <p className="t-lead">Let&apos;s try again. You haven&apos;t been charged.</p>
        <div className="flex flex-wrap" style={{ gap: u(1.2) }}>
          {canRetry && (
            <button className="btn btn-lg btn-main" onClick={onRetry}>
              Try again
            </button>
          )}
          <button className="btn btn-soft" onClick={onRetake}>
            📸 New photo
          </button>
        </div>
      </div>
    </Split>
  );
}

// ================================================================ sheets + pay

/** "Add 1 more for $8" — what the next sheet costs at the bundle price. */
function bundleHint(count: number) {
  if (count >= 3) return `Best deal: ${priceLabel(bundlePrice(1) * 3 - bundlePrice(3))} off`;
  if (count === 0) return `1 for ${priceLabel(bundlePrice(1))} · 2 for ${priceLabel(bundlePrice(2))} · 3 for ${priceLabel(bundlePrice(3))}`;
  return `Add ${count === 1 ? "another" : "the last one"} for just ${priceLabel(bundlePrice(count + 1) - bundlePrice(count))}`;
}

/** A phone held upright: the guest is on their own device, so "Pay" beats a QR. */
function useIsHandset() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px), (max-height: 500px) and (pointer: coarse)");
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return on;
}

/** Event looks: the welcome video with the print status under it. */
function EventWait({ video, status }: { video: React.ReactNode; status: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center landscape:flex-row portrait:flex-col" style={{ gap: u(2.4), padding: `${u(1)} ${u(3)} ${u(2)}` }}>
      <div className="landscape:w-[62%] portrait:w-full">{video}</div>
      <div className="landscape:w-[32%] portrait:w-full">{status}</div>
    </div>
  );
}

function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait) and (max-width: 820px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/** Where each sticker sits on a pack12 sheet, as % of the sheet (for the loading spinners). */
const slotCenters = () => LAYOUTS[sheetLayout()].map(([x, y, w, h]) => ({ left: ((x + w / 2) / SHEET_W) * 100, top: ((y + h / 2) / SHEET_H) * 100, size: (Math.min(w, h) / SHEET_W) * 100 }));

/**
 * The moment the sticker lands, in two parts on one scrolling screen:
 *   1. the before/after slider, big; dragging it all the way (or tapping
 *      "See my sheets") scrolls down to
 *   2. all three 12-sticker sheets side by side, a spinner on every sticker
 *      that's still being drawn, tap to add/remove, and the order with a big
 *      pay QR (Pose Party is picked from the start, so the QR is already up).
 */
function SheetShop({
  photo,
  sticker,
  variants,
  picked,
  freeMode,
  sheetsLeft,
  canRetry,
  onToggle,
  onRetry,
  onRetake,
  onPaid,
  onCheckout,
  onPayUrl,
}: {
  photo: string | null;
  sticker: string;
  variants: Variants;
  picked: SheetKind[];
  freeMode: boolean;
  sheetsLeft: number;
  canRetry: boolean;
  onToggle: (id: SheetKind) => void;
  onRetry: () => void;
  onRetake: () => void;
  onPaid: (checkoutId?: string) => void;
  onCheckout: (checkoutId: string) => Promise<void>;
  /** the live Stripe checkout for these sheets (shared with a paired phone) */
  onPayUrl?: (url: string | null, sheets: SheetKind[]) => void;
}) {
  const [previews, setPreviews] = useState<Partial<Record<SheetKind, string>>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const sheetsRef = useRef<HTMLElement>(null);
  const scrolled = useRef(false);
  const showSheets = useCallback(() => {
    scrolled.current = true;
    sheetsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  // not everyone drags the slider: move on by itself after a while
  useEffect(() => {
    const t = setTimeout(() => !scrolled.current && showSheets(), 12000);
    return () => clearTimeout(t);
  }, [showSheets]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      SHEET_DESIGNS.forEach((d) =>
        buildSheet(d.id, sticker, variants, true)
          .then((img) => alive && setPreviews((p) => ({ ...p, [d.id]: img })))
          .catch(() => {})
      );
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [sticker, variants]);

  const count = picked.length;
  const tooMany = count > sheetsLeft;
  const phone = useIsPhone();
  // carousel (phone): which sheet is centred, and jumping to one
  const carousel = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const onCarouselScroll = () => {
    const el = carousel.current;
    if (!el || !el.children.length) return;
    const w = (el.children[0] as HTMLElement).offsetWidth;
    setShown(Math.max(0, Math.min(SHEET_DESIGNS.length - 1, Math.round(el.scrollLeft / (w || 1)))));
  };
  const scrollToSheet = (i: number) => (carousel.current?.children[i] as HTMLElement | undefined)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

  return (
    <div ref={scroller} className="h-full w-full overflow-y-auto overflow-x-hidden scroll-smooth">
      {/* 1 — the reveal */}
      <section className="flex h-full flex-col items-center" style={{ gap: u(0.8), padding: `${u(0.4)} ${u(2)} ${u(1)}` }}>
        <h2 className="t-h2 text-center short:hidden">
          Ta-da! <span className="pop">That&apos;s you.</span>
        </h2>
        <div className="relative min-h-0 w-full flex-1">
          <BoothReveal photo={photo} sticker={sticker} onRevealed={() => setTimeout(showSheets, 700)} />
        </div>
        <div className="t-body text-center">Drag the slider all the way 👉 to see your whole sticker</div>
        <div className="flex flex-wrap justify-center" style={{ gap: u(0.8) }}>
          <button className="btn btn-lg btn-main" onClick={showSheets}>
            See my sticker sheets ↓
          </button>
          {canRetry && (
            <button className="btn btn-soft" onClick={onRetry}>
              🔄 Redo
            </button>
          )}
          <button className="btn btn-soft" onClick={onRetake}>
            📸 New photo
          </button>
        </div>
      </section>

      {/* 2 — the sheets + the order.
          Phone (portrait): one big sheet at a time in a swipe carousel, a big Add button under
          each, and a compact pay bar pinned to the bottom.
          Laptop (landscape): the three sheets side by side, the order + QR beside them. */}
      <section
        ref={sheetsRef}
        className="relative flex min-h-full flex-col landscape:flex-row short:!flex-col"
        style={{ gap: u(1.2), paddingTop: u(1) }}
      >
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: u(0.6) }}>
          <div style={{ padding: `0 ${u(2)}` }}>
            <h2 className="t-h2">
              Pick your <span className="pop">sheets</span>
            </h2>
            <div className="t-body">
              12 stickers each · <span className="landscape:hidden">swipe to see all 3 · </span>
              <span className="text-[#15803d]">{bundleHint(count)}</span>
            </div>
          </div>
          <div
            ref={carousel}
            onScroll={onCarouselScroll}
            className="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden landscape:grid landscape:grid-cols-3 landscape:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ gap: u(1.2), padding: `${u(0.6)} ${u(2)} ${u(0.8)}`, scrollPaddingInline: u(2) }}
          >
            {SHEET_DESIGNS.map((d) => {
              const on = picked.includes(d.id);
              const srcs = sheetSources(d.id, sticker, variants, true);
              const loading = srcs.flatMap((src, i) => (src ? [] : [i]));
              return (
                <div
                  key={d.id}
                  className="flex shrink-0 snap-center flex-col items-center portrait:w-[min(70vw,calc((100dvh-420px)*0.582),420px)] landscape:w-auto"
                  style={{ gap: u(0.7) }}
                >
                  {/* the sheet itself, big, like the real thing on the table */}
                  <motion.button
                    onClick={() => onToggle(d.id)}
                    className={cn(
                      "relative w-full bg-white transition-shadow landscape:w-[min(100%,calc((100dvh-370px)*0.582))]",
                      on ? "shadow-[0_0_0_5px_var(--purple),0_18px_40px_rgba(91,63,214,0.30)]" : "shadow-[0_12px_30px_rgba(26,26,46,0.16)]"
                    )}
                    style={{ aspectRatio: "3.9 / 6.7", borderRadius: 14 }}
                    whileTap={{ scale: 0.98 }}
                    aria-pressed={on}
                    aria-label={`${d.name} sheet`}
                  >
                    {previews[d.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[d.id]} alt={`${d.name} sheet`} className="h-full w-full rounded-[14px]" />
                    ) : (
                      <div className="h-full w-full rounded-[14px] bg-[var(--lav)]" />
                    )}
                    {loading.map((i) => (
                      <span
                        key={i}
                        className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                        style={{ left: `${slotCenters()[i].left}%`, top: `${slotCenters()[i].top}%`, width: `${slotCenters()[i].size * 0.5}%`, aspectRatio: "1" }}
                      >
                        <motion.span
                          className="block h-full w-full rounded-full border-[3px] border-[var(--purple)] border-t-transparent"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                        />
                      </span>
                    ))}
                    {on && (
                      <span className="absolute -right-2 -top-2 flex items-center justify-center rounded-full bg-[var(--purple)] font-bold text-white shadow-lg" style={{ width: u(3.2), height: u(3.2), minWidth: 30, minHeight: 30, fontSize: `max(15px, ${u(1.6)})` }}>
                        ✓
                      </span>
                    )}
                  </motion.button>
                  <div className="text-center">
                    <div className="t-h3" style={{ fontSize: `max(17px, ${u(1.8)})` }}>
                      {d.emoji} {d.name}
                    </div>
                    <div className="t-body" style={{ fontSize: `max(13px, ${u(1.1)})` }}>
                      {loading.length ? `✨ drawing ${loading.length} more…` : d.blurb}
                    </div>
                  </div>
                  <button
                    className={cn("btn w-full", on ? "btn-main" : "btn-soft")}
                    onClick={() => onToggle(d.id)}
                    style={{ maxWidth: 320 }}
                  >
                    {on ? "✓ In your order" : `+ Add · ${priceLabel(bundlePrice(count + 1) - bundlePrice(count))}`}
                  </button>
                </div>
              );
            })}
          </div>
          {/* which sheet you're looking at (phone) */}
          <div className="flex justify-center landscape:hidden" style={{ gap: 8 }}>
            {SHEET_DESIGNS.map((d, i) => (
              <button
                key={d.id}
                aria-label={`Show ${d.name}`}
                onClick={() => scrollToSheet(i)}
                className={cn("h-2.5 rounded-full transition-all", i === shown ? "w-6 bg-[var(--purple)]" : "w-2.5 bg-[var(--lav)]", picked.includes(d.id) && i !== shown && "bg-[#b8a9f5]")}
              />
            ))}
          </div>
        </div>

        {/* the order: what's in it, the price, the QR (laptop) / a pay button (phone) */}
        <div
          className="card z-10 flex shrink-0 flex-col landscape:mr-[var(--gut)] landscape:mb-[var(--gut)] landscape:w-[32%] landscape:self-center portrait:sticky portrait:bottom-0 portrait:rounded-b-none short:!w-full"
          style={{ gap: u(0.7), padding: u(1.3), ["--gut" as string]: u(2) } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center" style={{ gap: u(0.5) }}>
            <span className="t-h3">Your order</span>
            {picked.map((id) => (
              <span key={id} className="chip bg-[var(--lav)] text-[var(--ink)]">
                {getSheet(id).emoji} {getSheet(id).name}
              </span>
            ))}
            {!count && <span className="t-body">Add a sheet above</span>}
          </div>
          {tooMany && <div className="t-body text-[var(--pink)]">Only {sheetsLeft} sheet{sheetsLeft === 1 ? "" : "s"} of paper left — pick fewer</div>}
          {count > 0 &&
            !tooMany &&
            (freeMode ? (
              <button className="btn btn-lg btn-main" onClick={() => onPaid()}>
                🖨️ Print {count === 1 ? "my sheet" : `my ${count} sheets`} · {count * STICKERS_PER_SHEET} stickers
              </button>
            ) : (
              <PayWithQr key={picked.join("+")} sheets={picked} onPaid={onPaid} onCheckout={onCheckout} onPayUrl={onPayUrl} compact={phone} />
            ))}
        </div>
      </section>
    </div>
  );
}

function PayWithQr({
  sheets,
  onPaid,
  onCheckout,
  onPayUrl,
  compact = false,
}: {
  sheets: SheetKind[];
  onPaid: (checkoutId?: string) => void;
  onCheckout: (checkoutId: string) => Promise<void>;
  onPayUrl?: (url: string | null, sheets: SheetKind[]) => void;
  /** phone: price + a big Pay button, QR on request */
  compact?: boolean;
}) {
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  // paying on this same phone pauses this tab: only offer it once the order is safely sent
  const [sentAhead, setSentAhead] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "waiting" | "free" | "error">("loading");
  const paidRef = useRef(false);
  const price = bundlePrice(sheets.length);
  const onPayUrlRef = useRef(onPayUrl);
  onPayUrlRef.current = onPayUrl;

  useEffect(() => {
    let alive = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    // guests often tap 2–3 sheets in a row: wait a beat before making a checkout
    const start = setTimeout(async () => {
      try {
        const res = await fetch("/api/booth/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheets }),
        });
        const data = await res.json();
        if (!alive) return;
        if (data.free) return setState("free");
        if (!res.ok || !data.url) throw new Error(data.error);
        setQr(await QRCode.toDataURL(data.url, { width: 560, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } }));
        setPayUrl(data.url);
        setState("waiting");
        onCheckout(data.id)
          .catch((e) => console.error("order pre-send failed", e))
          .finally(() => {
            if (!alive) return;
            setSentAhead(true);
            // a paired phone can pay this checkout too (the order is already at the print station)
            onPayUrlRef.current?.(data.url, sheets);
          });
        poll = setInterval(async () => {
          try {
            const r = await fetch(`/api/booth/checkout?id=${data.id}`);
            const s = await r.json();
            if (s.paid && !paidRef.current) {
              paidRef.current = true;
              clearInterval(poll);
              sounds.success();
              onPaid(data.id);
            }
          } catch {}
        }, 2000);
      } catch {
        if (alive) setState("error");
      }
    }, 600);
    return () => {
      alive = false;
      clearTimeout(start);
      if (poll) clearInterval(poll);
      onPayUrlRef.current?.(null, sheets);
    };
  }, [sheets, onPaid, onCheckout]);

  if (state === "free") {
    return (
      <button className="btn btn-lg btn-main w-fit" onClick={() => onPaid()}>
        🖨️ Print my sheets
      </button>
    );
  }

  if (compact && !showQr) {
    const ready = !!payUrl && sentAhead;
    return (
      <div className="flex flex-col" style={{ gap: u(0.5) }}>
        <div className="flex items-center" style={{ gap: u(1) }}>
          <div className="shrink-0">
            <div className="font-fun font-bold" style={{ fontSize: `max(30px, ${u(3.4)})`, lineHeight: 1 }}>
              {priceLabel(price)}
            </div>
            <div className="t-body" style={{ fontSize: 12 }}>
              {sheets.length * STICKERS_PER_SHEET} stickers
            </div>
          </div>
          {ready ? (
            <a className="btn btn-lg btn-main flex-1 justify-center text-center" href={payUrl!} target="_blank" rel="noopener noreferrer">
              Pay {priceLabel(price)} →
            </a>
          ) : (
            <button className="btn btn-lg btn-main flex-1 opacity-70" disabled>
              {state === "error" ? "Payment is down, ask staff" : "Getting ready…"}
            </button>
          )}
        </div>
        <div className="t-body flex items-center justify-between" style={{ fontSize: 12 }}>
          <span>Apple Pay · Google Pay · card · prints right after</span>
          {qr && (
            <button className="font-semibold text-[var(--purple)] underline" onClick={() => setShowQr(true)}>
              Show QR
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between" style={{ gap: u(1) }}>
      <div className="flex min-w-0 flex-col" style={{ gap: u(0.3) }}>
        <div className="font-fun font-bold" style={{ fontSize: u(3.6), lineHeight: 1 }}>
          {priceLabel(price)}
        </div>
        <div className="t-h3">📱 Scan to pay</div>
        <div className="t-body">Apple Pay, Google Pay, card</div>
        {payUrl &&
          (sentAhead ? (
            // already on your phone? pay in a new tab: the order is already at the print station
            <a className="btn btn-soft mt-1 w-fit" href={payUrl} target="_blank" rel="noopener noreferrer">
              💳 Pay here
            </a>
          ) : (
            <span className="t-body mt-1 opacity-70">Getting your sheets ready…</span>
          ))}
        {state === "waiting" && (
          <motion.div className="t-body text-[#15803d]" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
            ● Printing starts automatically
          </motion.div>
        )}
      </div>
      <div className="flex aspect-square shrink-0 items-center justify-center overflow-hidden bg-white" style={{ width: `clamp(140px, ${u(17)}, 50%)` }}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Scan to pay" className="h-full w-full" />
        ) : state === "error" ? (
          <span className="t-body text-center text-[var(--pink)]">Payment is down — please ask staff</span>
        ) : (
          <motion.span style={{ fontSize: u(4) }} animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            ✨
          </motion.span>
        )}
      </div>
    </div>
  );
}

// ================================================================ printing

/**
 * Printing = the hand-off to the print station (the Mac running StixCut).
 * Uploads each sticker once plus a numbered guide per sheet, and puts the
 * order on the print queue with every sticker's exact spot, while the guest
 * watches their sheets.
 */
type PrintOrder = {
  id: string;
  sheets: SheetKind[];
  checkoutId: string | null;
  /** event links: who made it, and their originals for their record */
  event?: string;
  guest?: { id: string; token: string };
  photoUrl?: string | null;
  stickerUrl?: string | null;
  sheetUrls?: string[];
};

const newOrderId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `o-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Upload each sticker once plus the guides, and put the order on the print queue. */
async function sendKit(guides: string[], kit: KitItem[], order: PrintOrder): Promise<boolean> {
  const up = (image: string) =>
    fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) })
      .then((r) => r.json())
      .then((d) => {
        if (!d.url) throw new Error("upload failed");
        return d.url as string;
      });
  const unique = Array.from(new Set(kit.map((k) => k.src)));
  const [guideUrls, imageUrls] = await Promise.all([Promise.all(guides.map(up)), Promise.all(unique.map(up))]);
  const urlOf = new Map(unique.map((s, i) => [s, imageUrls[i]]));
  const res = await fetch("/api/booth/kit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guide: guideUrls[0],
      guides: guideUrls,
      items: kit.map((k) => ({ sheet: k.sheet, n: k.n, url: urlOf.get(k.src), x: k.x, y: k.y, w: k.w, h: k.h })),
      order,
    }),
  });
  const data = await res.json();
  return !!data.queued;
}

/** What /api/booth/order-status returns. */
type OrderProgress = {
  status: "queued" | "printing" | "done" | "failed";
  stage: "preparing" | "printing" | null;
  stageAt: string | null;
  verified: boolean;
  ahead: number;
  sheets: number;
  serverTime: string;
};
const SHEET_SECONDS = 130; // print + cut, per sheet

/** Turn the order's live status into a bar position (0–1) and a line of text. */
function printPhase(sent: "sending" | "queued" | "error", p: OrderProgress | null, clockSkew: number): { pct: number; label: string; detail?: string } {
  if (sent === "error") return { pct: 0.02, label: "Couldn't reach the printer", detail: "Please tell staff: your payment went through." };
  if (sent === "sending" || !p) return { pct: 0.04, label: "Sending to the printer…" };
  const since = (iso: string | null) => (iso ? Math.max(0, (Date.now() + clockSkew - Date.parse(iso)) / 1000) : 0);
  if (p.status === "failed") return { pct: 0.5, label: "The printer hit a snag", detail: "Staff have been told and will sort it out." };
  if (p.status === "done") return { pct: 1, label: "Done! Grab your stickers 🎉" };
  if (p.status === "queued") {
    if (!p.verified) return { pct: 0.08, label: "Confirming your payment…" };
    return p.ahead > 0
      ? { pct: 0.12, label: `In line: ${p.ahead} ${p.ahead === 1 ? "sheet" : "orders"} ahead of you`, detail: `About ${Math.ceil((p.ahead * SHEET_SECONDS) / 60)} min` }
      : { pct: 0.16, label: "You're up next!" };
  }
  if (p.stage !== "printing") return { pct: Math.min(0.3, 0.2 + since(p.stageAt) / 300), label: "Laying out your sheet…" };
  const total = SHEET_SECONDS * p.sheets;
  const t = since(p.stageAt);
  const left = Math.max(5, Math.round(total - t));
  return {
    pct: Math.min(0.97, 0.3 + 0.67 * (t / total)),
    label: t < total * 0.55 ? "Printing your stickers…" : "Cutting them out…",
    detail: `About ${left >= 60 ? `${Math.ceil(left / 60)} min` : `${left} s`} left`,
  };
}

function PrintKit({ guides, kit, order, onDone, waitWith }: { guides: string[] | null; kit: KitItem[] | null; order: PrintOrder | null; onDone: () => void; waitWith?: (status: React.ReactNode) => React.ReactNode }) {
  const [sent, setSent] = useState<"sending" | "queued" | "error">("sending");
  const [progress, setProgress] = useState<OrderProgress | null>(null);
  const [skew, setSkew] = useState(0);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!kit || !guides || !order) return;
    let alive = true;
    (async () => {
      try {
        const queued = await sendKit(guides, kit, order);
        if (alive) setSent(queued ? "queued" : "error");
      } catch {
        if (alive) setSent("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [kit, guides, order]);

  // live status from the print station, every 2 s until it's done
  useEffect(() => {
    if (sent !== "queued" || !order) return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/booth/order-status?id=${encodeURIComponent(order.id)}`, { cache: "no-store" });
        if (!r.ok) return;
        const p = (await r.json()) as OrderProgress;
        if (!alive) return;
        setSkew(Date.parse(p.serverTime) - Date.now());
        setProgress((prev) => {
          if (p.status === "done" && prev?.status !== "done") sounds.success();
          return p;
        });
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    const t = setInterval(() => tick((n) => n + 1), 1000); // smooth countdown between polls
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(t);
    };
  }, [sent, order]);

  const phase = printPhase(sent, progress, skew);
  const done = progress?.status === "done";
  const n = order?.sheets.length ?? 1;

  const status = (
    <div className="flex flex-col items-center text-center" style={{ gap: u(0.8) }}>
      <div className="flex items-center" style={{ gap: u(1) }}>
        {guides?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={guides[0]} alt="Your sheet" className="shrink-0 rounded-md bg-white shadow short:hidden" style={{ height: `max(72px, ${u(11)})`, aspectRatio: "3.9 / 6.7" }} />
        )}
        <div className="flex flex-col text-left" style={{ gap: 2 }}>
          <div className="t-h3">{n === 1 ? "Your sheet" : `Your ${n} sheets`}</div>
          <div className={cn("t-body font-bold", done ? "text-[#15803d]" : sent === "error" || progress?.status === "failed" ? "text-[var(--pink)]" : "text-[var(--ink)]")}>{phase.label}</div>
          {phase.detail && <div className="t-body">{phase.detail}</div>}
        </div>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-[var(--lav)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(phase.pct * 100)}>
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", done ? "from-[var(--cyan)] to-[var(--green)]" : "from-[var(--purple)] to-[var(--pink)]")}
          animate={{ width: `${phase.pct * 100}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <div className="t-body flex w-full justify-between opacity-70" style={{ fontSize: `max(11px, ${u(1)})` }}>
        <span>Sent</span>
        <span>In line</span>
        <span>Printing</span>
        <span>Cut ✂️</span>
      </div>
      {/* always there, so staff can move on if the station is offline; loud once it's done */}
      <button className={done ? "btn btn-lg btn-main" : "btn btn-soft"} onClick={onDone}>
        {done ? "Got them! 🎉" : "I've got my stickers"}
      </button>
    </div>
  );

  return waitWith ? <>{waitWith(status)}</> : <PlayWhileYouWait status={status} />;
}

// ================================================================ done

function Done({
  sticker,
  digitalUrl,
  emailOn,
  autoEmailedTo,
  onFinish,
  claim,
}: {
  sticker: string | null;
  digitalUrl: string | null;
  emailOn: boolean;
  autoEmailedTo: string | null;
  onFinish: () => void;
  /** event links: the QR also signs the guest up and claims this order */
  claim?: { event: string; orderId: string } | null;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!digitalUrl) return;
    const page = `${location.origin}/booth/get?u=${encodeURIComponent(digitalUrl)}${claim ? `&e=${claim.event}&o=${claim.orderId}` : ""}`;
    QRCode.toDataURL(page, { width: 420, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [digitalUrl, claim]);

  const send = async () => {
    if (!digitalUrl || !email) return;
    setSendState("sending");
    try {
      const r = await fetch("/api/booth/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: digitalUrl, email }),
      });
      const d = await r.json();
      if (!r.ok || !d.sent) throw new Error();
      setSentTo(d.to);
      setSendState("sent");
      setEmail("");
      sounds.success();
    } catch {
      setSendState("error");
    }
  };

  return (
    <div className="relative h-full w-full">
      <Confetti />
      <Split>
        <div className="relative flex items-center justify-center short:hidden landscape:h-full landscape:w-[34%] portrait:w-full portrait:min-h-0 portrait:flex-1">
          {sticker && (
            <motion.img
              src={sticker}
              alt=""
              className="die-cut h-[80%] max-h-full max-w-full object-contain"
              animate={{ rotate: [-5, 5, -5], scale: [1, 1.04, 1] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            />
          )}
        </div>
        <div className="flex flex-col landscape:w-[54%] short:!w-full portrait:items-center portrait:text-center" style={{ gap: u(1.4) }}>
          <h2 className="t-h2">
            Peel, stick, <span className="pop">show off!</span>
          </h2>
          <p className="t-lead short:hidden">Grab your stickers from the tray, and take the pics with you 👇</p>

          <div className="card flex w-full flex-wrap items-center text-left portrait:justify-center" style={{ gap: u(1.6), padding: u(1.4) }}>
            {/* phone QR */}
            <div className="flex items-center" style={{ gap: u(1.2) }}>
              <div className="flex shrink-0 items-center justify-center bg-white" style={{ width: `max(104px, ${u(12)})`, height: `max(104px, ${u(12)})` }}>
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="Scan to save" className="h-full w-full" />
                ) : (
                  <motion.span style={{ fontSize: u(3) }} animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    ✨
                  </motion.span>
                )}
              </div>
              <div style={{ maxWidth: "15em" }}>
                <div className="t-h3">{claim && !autoEmailedTo ? "📲 Get all your stickers" : "📲 Save to your phone"}</div>
                <div className="t-body">{claim && !autoEmailedTo ? "Scan, add your email, and we'll send you every sticker." : "Scan with your camera, then tap Save or text it to friends."}</div>
              </div>
            </div>

            {/* email */}
            {emailOn && (
              <div className="flex min-w-[240px] flex-1 flex-col" style={{ gap: u(0.6) }}>
                <div className="t-h3">📧 Email me the pics</div>
                {autoEmailedTo && <div className="t-body text-[#15803d]">✓ Sent to {autoEmailedTo}</div>}
                {sendState === "sent" ? (
                  <div className="t-body text-[#15803d]">✓ Sent to {sentTo}! Check your inbox.</div>
                ) : (
                  <form
                    className="flex"
                    style={{ gap: u(0.6) }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                  >
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="t-body min-w-0 flex-1 rounded-full border-2 border-[#e4dcff] bg-white px-4 py-2 text-[var(--ink)] outline-none focus:border-[var(--purple)]"
                      style={{ userSelect: "text" }}
                    />
                    <button className="btn btn-main" disabled={!email || !digitalUrl || sendState === "sending"}>
                      {sendState === "sending" ? "Sending…" : "Send"}
                    </button>
                  </form>
                )}
                {sendState === "error" && <div className="t-body text-[var(--pink)]">Couldn&apos;t send. Check the address and try again.</div>}
              </div>
            )}
          </div>

          <button className="btn btn-soft w-fit" onClick={onFinish}>
            Done
          </button>
        </div>
      </Split>
    </div>
  );
}

function Confetti() {
  const colors = ["#7c5cfc", "#ff6b9d", "#feca57", "#45e3ff", "#2ed573", "#ff9f43"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 48 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, width: u(0.8), height: u(1.1), background: colors[i % colors.length] }}
          initial={{ y: -40, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: 360 * (i % 2 ? 1 : -1) }}
          transition={{ duration: 3 + (i % 5) * 0.5, delay: (i % 10) * 0.15, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
