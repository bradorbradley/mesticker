# Booth app — running MeSticker on the laptop + Liene PixCut S1

The booth screen lives at **`/booth`** (e.g. `https://mesticker.fun/booth`). It's a landscape, touch-first
version of MeSticker with the mascot, a 3-2-1 photo countdown, QR-code payment and a print file sized
for the PixCut S1.

## Guest flow

1. **Attract** — mascot + examples. Tap anywhere (also goes fullscreen).
2. **Pick a style** — 5 styles + "Surprise me".
3. **Pose** — live camera, 3-2-1 countdown, flash, retake / keep.
4. **Preview** — sticker is generated free (~20 s). Up to 3 tries per guest.
5. **Pay** — QR code → Stripe Checkout on the guest's own phone (Apple Pay / Google Pay / card).
   The booth polls Stripe and moves on by itself when paid.
6. **Print** — the booth shows the Liene kit for staff: the numbered sheet guide + the 8 images to
   upload one by one into the Liene app (see below).
7. **Done** — confetti + QR code for the digital copy. Resets itself after 30 s.

Any screen left untouched for ~1 minute returns to the attract screen.

## Menu (what the PixCut S1 makes from a 4×7" sheet)

Every sheet holds 8 stickers in the `kit8` layout: a big #1, two beside it, two medium, three small,
no tilts (so it's easy to copy by hand), ≥2.5mm between cut lines.

| Item | On the sheet | Price |
|---|---|---|
| Pose Sheet (default) | their sticker + 7 new poses, same style | $25 |
| Sticker Sheet | their sticker 8 times, all sizes | $20 |
| Mix Sheet | their sticker + 7 that change pose AND style | $25 |

The 7 poses start generating the moment the photo is taken (in parallel with the main sticker), so the
sheet preview fills in during the reveal: 8 image generations per guest (~$0.35). Mix stickers are only
made if a guest taps Mix. Paper + ribbon ≈ $0.60/sheet.

## Printing: the Liene kit (staff, ~1 min + 2 min print/cut)

The Liene app needs each image added on its own, then **Remove background** on each (multi-select
doesn't offer it). After payment the booth shows the **Liene kit**:

- a numbered guide of the sheet, and images **1–8** with their size in inches;
- **Download all 8** (or tap one) to save them to this laptop, or scan the QR with the phone running
  the Liene app → **Save all 8 to Photos** (`/booth/kit`), with a "Placed?" checklist.

Then in the Liene app:

1. **Sticker** → new **4×7** canvas.
2. For 1 → 8: add the image → **Remove background** → resize to the size shown → drag it to its
   numbered spot. Leave a small gap between stickers.
3. **Print** (print + cut ≈ 2 min). Tap **Got them!** on the booth when the sheet is out.

Practice: turn on Free mode in the staff panel and run through it. "Open the Liene kit again" in the
staff panel reopens the last kit.

## Staff panel

**Hold the "MeSticker" logo (top-left) for 2 seconds.**

- Sheets left (booth shows "out of stickers" at 0) — tap **Refilled (36)** after loading a cassette
- Free mode on/off
- Prints today
- Last generation model + seconds
- Open the Liene kit again · Mark as paid (cash) · Fullscreen · Reset

## Run it like an app (no browser bars)

- **iPhone / iPad:** open `/booth` in Safari → Share → **Add to Home Screen**. Launch it from the icon.
- **Android / Chrome:** menu → **Install app** (or Add to Home screen).
- Works in any orientation; the booth itself is built for landscape.
- Tap the step pills at the top to jump back to an earlier step.

## Laptop setup

- Chrome kiosk mode: `chrome.exe --kiosk --autoplay-policy=no-user-gesture-required https://mesticker.fun/booth`
- Allow camera for the site once.
- Chrome settings → Downloads → turn off "Ask where to save each file".
- Windows: disable sleep / screen-off while plugged in.
- Keep a phone hotspot as Wi-Fi backup.

## Settings (Vercel env vars)

| Var | What |
|---|---|
| `NEXT_PUBLIC_BOOTH_PRICES` | Menu prices in cents, default `pose:2500,sheet:2000,mix:2500` |
| `RESEND_API_KEY` + `BOOTH_EMAIL_FROM` | Turns on "Email me the pics" (domain must be verified in Resend) |
| `NEXT_PUBLIC_BOOTH_FREE_MODE` | `1` = no payment (demos) |
| `BOOTH_IMAGE_PROVIDER` | `openai` (default), `gemini` (Nano Banana 2) or `fal` (FLUX Kontext) |
| `GEMINI_API_KEY` / `FAL_KEY` | Keys for the alternative models |
| `BOOTH_PREVIEW_QUALITY` | OpenAI quality, default `medium` (same as the web app); `low` is faster but rougher |
| `BOOTH_PRINT_QUALITY` | Unset by default; set `high` to also make a sharper print copy in the background |
| `STRIPE_SECRET_KEY` | Already set for the web app; without it the booth runs free |

To compare speed: switch `BOOTH_IMAGE_PROVIDER`, make a sticker, and read the seconds in the staff panel.
