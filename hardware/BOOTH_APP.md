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
6. **Print** — the booth saves `mesticker-print-<time>.png` (1 big + 4 small stickers, white cut border,
   3.9×6.7" at 300 DPI) to the laptop's Downloads folder.
7. **Done** — confetti + QR code for the digital copy. Resets itself after 30 s.

Any screen left untouched for ~1 minute returns to the attract screen.

## Menu (what the PixCut S1 makes from a 4×7" sheet)

Every sheet is 1 big (2.7") + 4 minis (1.8"). What goes on it:

| Item | On the sheet(s) | Sheets | Price |
|---|---|---|---|
| Sticker Sheet | 5 of their sticker | 1 | $20 |
| Pose Pack | their sticker + 4 new poses (web app's variations engine) | 1 | $25 |
| Style Pack | their sticker + the same photo in the 4 other cartoon styles | 1 | $25 |
| Party Pack | a Pose sheet + a Style sheet, 10 different stickers | 2 | $40 |

Poses/styles are only generated when a pack is tapped (~4¢ poses, ~16¢ styles). The left panel
switches to a live preview of the sheet(s), filling in as each sticker is made. Paper + ribbon ≈ $0.60/sheet.

## Printing (for now: one click by staff)

Liene has no API, so for the pilot:

1. When the booth says "Printing…", open the newest `mesticker-print-*.png` from Downloads in the
   **Liene Photo** app (4×7 sticker paper).
2. Press **Print & Cut**.

Next step once the printer is here: a small Windows script that watches Downloads and clicks Print
automatically.

## Staff panel

**Hold the "MeSticker" logo (top-left) for 2 seconds.**

- Sheets left (booth shows "out of stickers" at 0) — tap **Refilled (36)** after loading a cassette
- Free mode on/off
- Prints today
- Last generation model + seconds
- Download print file again · Mark as paid (cash) · Fullscreen · Reset

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
| `NEXT_PUBLIC_BOOTH_PRICES` | Menu prices in cents, default `sheet:2000,pose:2500,style:2500,party:4000` |
| `RESEND_API_KEY` + `BOOTH_EMAIL_FROM` | Turns on "Email me the pics" (domain must be verified in Resend) |
| `NEXT_PUBLIC_BOOTH_FREE_MODE` | `1` = no payment (demos) |
| `BOOTH_IMAGE_PROVIDER` | `openai` (default), `gemini` (Nano Banana 2) or `fal` (FLUX Kontext) |
| `GEMINI_API_KEY` / `FAL_KEY` | Keys for the alternative models |
| `BOOTH_PREVIEW_QUALITY` | OpenAI quality, default `medium` (same as the web app); `low` is faster but rougher |
| `BOOTH_PRINT_QUALITY` | Unset by default; set `high` to also make a sharper print copy in the background |
| `STRIPE_SECRET_KEY` | Already set for the web app; without it the booth runs free |

To compare speed: switch `BOOTH_IMAGE_PROVIDER`, make a sticker, and read the seconds in the staff panel.
