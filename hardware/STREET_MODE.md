# Street mode: selling on the go with the print station laptop

Carry the Windows print station laptop (hardware/station/WINDOWS.md) in a backpack, on your phone's
hotspot, with the PixCut S1 connected to it as usual. Guests order on their own phone; every paid
order goes on the same print queue as the booth, so the laptop prints and cuts it automatically,
each sticker as its own image.

## Guest (their phone): `/street`

1. Scan your QR → **Take my selfie** (front camera, 3-2-1).
2. Their sticker appears in ~20 s; the 7 poses fill in under it.
3. **Print my sheet** → Stripe Checkout (Apple Pay / Google Pay / card), or **I'll pay cash**.
4. They land on a page with a big **code** (e.g. `K7`). That page finishes any poses their tab
   didn't get to, gives each sticker its white die-cut border, and sends the order to the print
   queue. It then shows "In line", "Printing and cutting…" and "ready!" from the laptop.

## You (your phone): `/street/print`

- First time: enter your **street key** (`STREET_KEY` in Vercel; the station's `MCP_SECRET` works too).
- Safari → Share → **Add to Home Screen** to run it full screen.
- Tap **Start selling**: chime for new orders, screen stays on.
- **QR** tab: a big QR for `/street` to show people, and **Save QR to Photos** to print a sign.

Each order card shows the code, payment and where it is on the laptop.

- **Cash**: take the money, tap **Got the cash: print it**. Cash orders don't print before that.
- If the guest closed their page before it sent, your phone sends it after 45 s
  (or tap **Send to printer now**).
- **Print again** puts a done or failed order back on the laptop.
- No laptop? **Save the stickers** shares each sticker as its own image: Liene → Upload → pick
  them all → Print, so the printer still cuts each one.

## The laptop

Same station as the booth: `node hardware/station/autopilot.mjs` (see WINDOWS.md). It claims
street orders like booth orders; nothing to change. Free test orders (no Stripe) print only when
it runs with `--include-unverified`.

The station only downloads images from mesticker.fun (and Vercel Blob), and Vercel previews sit
behind a Vercel login, so a full test with the laptop runs on production.

## Settings (Vercel env vars)

| Var | What |
|---|---|
| `STREET_KEY` | Unlocks `/street/print`. Any long random string. |
| `NEXT_PUBLIC_BOOTH_BUNDLE_PRICES` | First value is the street price (one Pose Party sheet), default `1000` = $10 |
| `NEXT_PUBLIC_BOOTH_FREE_MODE` | `1` = no payment; orders show as "Free (test)" |
| `STRIPE_SECRET_KEY` | Without it, street mode runs free |

Street orders keep their own `street_orders` table and go on `booth_queue` under the same id once
paid (`src/lib/street-print.ts`).
