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

This claims the oldest order and saves it to `~/MeSticker Orders/<orderId>/`:

- `stickers/s01.png …`: each distinct sticker once. They're already transparent with a white die-cut
  border, so **no background removal is needed**.
- `sheet-N-guide.png`: the sheet exactly as the guest saw it, with numbered spots.
- `order.json`: `sheets[].placements[]` = `{ n, file, x, y, w, h }`, in inches from the top-left of
  the **printable area** (3.9 × 6.7", which starts 0.05" in from the left and 0.15" down on 4 × 7" paper).

## Station agent playbook (StixCut)

The goal is a fast, accurate sheet every time: 12 stickers per sheet (`pack12`: a ~2.2" hero, two
~1.1" beside it, three rows of three), at least 2.5 mm of paper between cut lines, nothing off the
printable area. Budget about 2 minutes of arranging per sheet; print + cut is another ~2.

For each sheet in `order.json`, in order:

1. **Build the layout (seconds, exact).**
   `node hardware/station/stixcut-layout.mjs <orderId>` writes `sheet-N.stixcut`: every sticker at its
   spot and size, kiss cut (perf off), a 0.4 mm cut margin just outside the white border, and each
   sticker's cut line traced from its outline. Don't drag stickers by hand.
2. **Open it.** `open -a StixCut "~/MeSticker Orders/<orderId>/sheet-N.stixcut"`. The sheet appears fully
   arranged ("sheet-N · 12 stickers").
3. **Printer.** It must say "1 READY · PixCut S1-…". If it says NOT CONNECTED, check the USB-C cable
   and that the printer is on, then click Connect Printer → Add.
4. **Quality check.** Screenshot the sheet and compare it against `sheet-N-guide.png` before printing:
   - 12 stickers, each in its numbered spot, none missing, none duplicated by mistake
   - every face crisp and recognizable, nothing clipped at an edge, no stray background boxes
   - the hero is the guest's main sticker; nothing upside down or mirrored
   - every pink cut line is closed and separate from its neighbours; nothing within ~0.1" of the paper edge
   If anything fails, fix it. If a sticker image itself is bad (wrong person, broken), stop and
   `failed` the order with the reason instead of printing it.
5. **Print & Cut**, then a quick look at the printed sheet: colours present, cuts aligned with the
   print. Misaligned cuts mean a recalibration (StixCut → Printer → Cut Calibration) before the next order.

`station.mjs next` already cleans every sticker (drops AI haze and specks the cutter would trace).
`station.mjs clean <orderId>` re-cleans an order that's already on disk.

When every sheet is printed:

- `node hardware/station/station.mjs done <orderId>`
- `node hardware/station/station.mjs failed <orderId> "paper jam"` (with what went wrong)
- `node hardware/station/station.mjs requeue <orderId>` (puts it back in line)

An order claimed but not finished within 15 minutes goes back in line automatically.
`node hardware/station/station.mjs list [queued|printing|done|failed]` shows the queue.

**Cost per sheet:** 15 AI images per guest (~$0.60 at medium quality), made whether or not they buy,
plus paper and ink of about $0.60 per sheet. Layout file format: see the header of `stixcut-layout.mjs` (JSON, schemaVersion 4, 96 units/inch, centred positions).
