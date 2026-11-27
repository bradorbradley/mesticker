# MeSticker iOS app

A thin native shell: the mesticker.fun booth/admin pages full screen, plus the printer links a
browser can't get on iPhone/iPad:

- **Bluetooth LE**: CoreBluetooth exposed to the page as Web Bluetooth (`navigator.bluetooth`),
  so the existing printer code (`hardware/station/pixcut/ble.mjs`) runs unchanged.
- **Fast Bluetooth**: the classic-Bluetooth link the Liene app uses (ExternalAccessory), exposed
  as `window.mestickerNative.accessory`; driven by `hardware/station/pixcut/stream.mjs`.
  The admin and test pages show **Fast connect (app)** only inside the app.

Also: keeps the screen awake, Bluetooth keeps running in the background, camera allowed for the booth,
payment links open in Safari. Screens live on the website, so web changes need no new build.

## Build (Mac with Xcode)

```bash
brew install xcodegen        # once
cd ios && xcodegen           # makes MeSticker.xcodeproj
open MeSticker.xcodeproj
```

In Xcode: MeSticker target → Signing & Capabilities → Team: your Apple ID / developer team.
Plug in the iPhone/iPad, pick it at the top, press Run. (Free Apple ID: the app expires after 7
days. Developer Program: 1 year, and TestFlight.)

## Fast Bluetooth: the protocol name

Apple only lets an app open a classic-Bluetooth accessory under the protocol names in its
Info.plist. Copy the printer's from the Liene app (on the Mac):

```bash
plutil -p "/Applications/Liene Photo.app/Contents/Info.plist" | grep -i -A5 accessory
```

Put it in `MeSticker/Info.plist` → `UISupportedExternalAccessoryProtocols` (replace
`REPLACE_WITH_LIENE_PROTOCOL`). Pair the printer in Settings → Bluetooth first.
Apple checks accessory approval at App Store review; builds installed from Xcode/TestFlight are
for our own devices.

## Debugging

Safari on the Mac → Develop → (device) → mesticker.fun shows the page's console.
