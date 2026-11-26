# Printing straight from the booth web page (no laptop script, no StixCut)

Status: test bench live at `/booth/printer`. Not yet proven on our own printer.

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
- `src/app/booth/printer/page.tsx`: the test bench. Test sheet in `public/booth/printer-test/`.

## Next

1. Run the bench on the real printer: Chrome on the Mac by USB, then by Bluetooth; Bluefy on the iPad.
2. Whichever works: build each paid sheet's JPEG + PLT on the server and have the booth page print it itself.
