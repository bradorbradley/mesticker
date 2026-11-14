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

1. **New sheet.** File → New. Media **4.00 × 7.00 in Cut**, cut mode **Kiss** (never Perf, which
   scores the cutting strip and can jam). Printer shows "1 READY".
2. **Import once.** Add Files… → select all of `stickers/` for this order (a single import).
3. **Place by numbers.** For each placement, drag `file` onto the sheet, then set its size to `w × h`
   and its position to `x, y`. Use the inspector fields, not dragging by eye. Add the printable-area
   offset if StixCut measures from the paper edge. Repeats (same `file` in several slots) are
   intended: the small last row repeats favourites.
4. **Cut lines.** Each sticker gets an auto-traced contour around its white border (kiss cut). No
   contour may touch or cross another, and keep about 30 px / 2.5 mm between them. If StixCut adds
   its own offset, keep it small (≤ 1 mm) so neighbours don't merge.
5. **Quality check.** Compare against `sheet-N-guide.png` before printing:
   - 12 stickers, each in its numbered spot, none missing, none duplicated by mistake
   - every face crisp and recognizable, nothing clipped at an edge, no stray background boxes
   - the hero is the guest's main sticker; nothing upside down or mirrored
   - every cut line is closed and separate; nothing within ~0.1" of the paper edge
   If anything fails, fix it. If a sticker image itself is bad (wrong person, broken), stop and
   `failed` the order with the reason instead of printing it.
6. **Print & Cut**, then a quick look at the printed sheet: colours present, cuts aligned with the
   print. Misaligned cuts mean a recalibration (StixCut → Printer → Cut Calibration) before the next order.

When every sheet is printed:

- `node hardware/station/station.mjs done <orderId>`
- `node hardware/station/station.mjs failed <orderId> "paper jam"` (with what went wrong)
- `node hardware/station/station.mjs requeue <orderId>` (puts it back in line)

An order claimed but not finished within 15 minutes goes back in line automatically.
`node hardware/station/station.mjs list [queued|printing|done|failed]` shows the queue.

**Cost per sheet:** 15 AI images per guest (~$0.60 at medium quality), made whether or not they buy,
plus paper and ink of about $0.60 per sheet. The exact StixCut clicks get recorded here once the
first sheet has been done by hand.
