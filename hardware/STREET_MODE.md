# Street mode: selling with a phone + the Liene PixCut S1

Walk around with the PixCut S1 (paired to your phone over Bluetooth in the Liene app) and a QR code.
Guests use their own phone; your phone gets the finished sheet.

## Guest (their phone): `/street`

1. Scan your QR → **Take my selfie** (front camera, 3-2-1).
2. Their sticker appears in ~20 s; the 7 poses fill in under it.
3. **Print my sheet** → Stripe Checkout (Apple Pay / Google Pay / card), or **I'll pay cash**.
4. They land on a page with a big **code** (e.g. `K7`) to show you. It flips to "ready!" when you tap Printed.

Every sticker is saved to the order as it's made, so nothing is lost when their tab leaves for Stripe.

## You (your phone): `/street/print`

- First time: enter your **street key** (`STREET_KEY` in Vercel; the station's `MCP_SECRET` works too). The phone remembers it.
- Safari → Share → **Add to Home Screen** to run it full screen.
- Tap **Start selling**: turns on the chime for new orders and keeps the screen awake.
- **QR** tab: a big QR for `/street` to show people, and **Save QR to Photos** to print a sign.

For each order (oldest first): code, payment (Paid / Cash: collect / Free test), poses ready.
Any poses the guest's phone didn't finish are made on your phone automatically, then the sheet is built.

1. **Print** → share sheet → **Save Image**.
2. Liene app → **Upload** → the newest photo. The sheet is a transparent PNG sized to the printable area
   (3.9 × 6.7", 1170 × 2010 px), every sticker with a white border, so it's ready to cut as is.
   Check the cut preview, then **Print**.
3. Tap **✓ Printed**: the guest's screen says it's ready.

## Why it isn't one tap

The Liene app only takes images through its own **Upload** button from the photo library. Liene documents
no share-sheet target, URL scheme, SDK or API, so a web page can't hand it a file directly. Save Image →
Upload is the shortest path. (The booth's Windows station drives the printer over USB instead.)

## Settings (Vercel env vars)

| Var | What |
|---|---|
| `STREET_KEY` | Unlocks `/street/print`. Any long random string. |
| `NEXT_PUBLIC_BOOTH_BUNDLE_PRICES` | First value is the street price (one Pose Party sheet), default `1000` = $10 |
| `NEXT_PUBLIC_BOOTH_FREE_MODE` | `1` = no payment; orders show as "Free (test)" |
| `STRIPE_SECRET_KEY` | Without it, street mode runs free |

Street orders live in their own `street_orders` table, so the booth's print station never picks them up.
