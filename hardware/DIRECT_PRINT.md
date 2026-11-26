# Printing straight from the booth web page (no laptop script, no StixCut)

Status: `/booth/admin` (connect the printer, auto-print paid orders) and the `/booth/printer` test bench are live.
Proven end to end against a simulated printer only; not yet on our own printer.

## How an order prints

1. Guest pays; the order is in the queue (`/api/booth/queue`), as before.
2. The admin page claims it and asks `/api/booth/print-job?id=&sheet=` for each sheet. The server downloads the
   stickers, removes specks, lays them out, traces the cut path and runs the same checks as the laptop station
   (`pixcut/sheet.mjs`). About 2 s per sheet.
3. The page sends JPEG + cut path to the printer over its USB or Bluetooth link, shows progress, then marks the order done.

The admin device must stay awake with the page in front: it asks the browser to keep the screen on, reconnects
by itself when it can, and unprinted orders simply wait in the queue. "Open booth" runs the booth on top of the
admin page so one tablet can do both.

## What is known (Nov 2026)

The PixCut S1 protocol has been worked out by several open-source projects:

| Link | How | Proven by |
|---|---|---|
| USB-C cable | WebUSB, vendor interface 2 (JSON) + 3 (data) | LTKMN/brencut (browser), popcornhax/PixCut-App |
| Bluetooth LE | Web Bluetooth, GATT service `ff00` (write `ff02`, replies `ff01`, write-ack `ff03`) | eastbaymakersclub/pixcut-s1 (Chrome, full 4×7 sheet) |
| Bluetooth Classic | RFCOMM + iAP2 (what the Liene phone app uses) | sincethestudy/liene-pixcut-s1-api; not reachable from any browser |

Both web paths send the same job: a 1216×2128 JPEG plus a PLT cut path (`combo-job`, cut path first).

## What each device can do

| Device + browser | USB | Bluetooth |
|---|---|---|
| Mac / Windows / Chromebook, Chrome or Edge | yes | yes |
| Android phone or tablet, Chrome | yes (USB-C cable) | yes |
| iPhone / iPad, Safari or Chrome | no | no (Apple has no Web Bluetooth / WebUSB) |
| iPhone / iPad, Bluefy browser (free, App Store) | no | expected yes, untested |
| iPhone / iPad, our own native app | no (needs Apple driver entitlement) | yes (CoreBluetooth); TestFlight/dev install avoids App Store review |

Bluetooth is slow: about 180 bytes per acknowledged write, so a 330 KB sheet is ~2,200 writes
(estimated 1–3 minutes before printing starts). USB sends the same sheet in a few seconds.

## Files

- `station/pixcut/protocol.mjs`: USB protocol (transport-agnostic).
- `station/pixcut/webusb.mjs`: WebUSB transport (from brencut, MIT).
- `station/pixcut/ble.mjs`: Web Bluetooth transport + job flow (ours). Tests: `node --test hardware/station/pixcut/ble.test.mjs`.
- `src/components/booth/print-admin.tsx`: the admin page (`/booth/admin`). `src/lib/print-job.ts`: server-side sheet builder.
- `src/app/booth/printer/page.tsx`: the test bench. Test sheet in `public/booth/printer-test/`.

## Next

1. Run the bench on the real printer: Chrome on the Mac by USB, then by Bluetooth; Bluefy on the iPad.
2. Whichever works: build each paid sheet's JPEG + PLT on the server and have the booth page print it itself.
