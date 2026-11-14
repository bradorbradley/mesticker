# Print station (Mac + PixCut S1 + StixCut)

The Mac next to the printer takes paid booth orders from the print queue and prints them.

## Why StixCut, not the Liene app

The Liene apps (Liene Photo, Liene Photo HD) are iPhone/iPad apps running on the Mac. Both crash
at **Add Printer → In-App Connection**, and neither can see the printer over USB. StixCut
(Art Hax LLC, notarized by Apple, `com.arthax.StixCut`) is a native Mac app that drives the
PixCut S1 directly over **USB-C**. It removes backgrounds on the Mac and does print + contour cut.
The free tier allows 3 prints/day after 7 days, so a booth needs the $89 lifetime license.

Printer setup: PixCut S1 plugged into the Mac with USB-C → StixCut → Connect Printer → **Add** →
"1 READY · PixCut S1-…". Don't add it as a macOS printer (System Settings): there is no Mac
driver, and it would never cut.

## One-time setup

```bash
mkdir -p ~/.mesticker-station && chmod 700 ~/.mesticker-station
pbpaste > ~/.mesticker-station/key   # copy MCP_SECRET from Vercel first
printf 'MCP_SECRET=%s\n' "$(cat ~/.mesticker-station/key)" > ~/.mesticker-station/env && rm ~/.mesticker-station/key
chmod 600 ~/.mesticker-station/env
```

## The loop

```bash
node hardware/station/station.mjs next                       # paid (Stripe-verified) orders only
node hardware/station/station.mjs next --include-unverified  # also free mode / cash
```

This claims the oldest order and saves `1.png … 8.png`, `guide.png` and `order.json` (sizes in
inches) to `~/MeSticker Orders/<orderId>/`. Then, in StixCut:

1. New 4×7 sheet, media **4.00 × 7.00 in Cut**. Use kiss-cut, not perf-cut, which wears the cutting strip.
2. Import the 8 images, remove backgrounds, size each one to its `w × h` and place it like `guide.png`.
3. **Print & Cut**.
4. Check the sheet against `guide.png`, then report back:
   - `node hardware/station/station.mjs done <orderId>`
   - `node hardware/station/station.mjs failed <orderId> "paper jam"`
   - `node hardware/station/station.mjs requeue <orderId>` (puts it back in line)

An order claimed but not finished within 15 minutes goes back in line automatically.

The exact StixCut click path gets recorded here after the first sheet is done by hand.

`node hardware/station/station.mjs list [queued|printing|done|failed]` shows the queue.
