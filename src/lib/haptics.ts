/** Haptic feedback patterns — safe no-op on desktop / unsupported browsers */

function vibrate(pattern: number | number[]) {
  try {
    navigator?.vibrate?.(pattern);
  } catch {
    // silently ignore — not all browsers support this
  }
}

/** Light tap — style selection, small buttons */
export function hapticLight() {
  vibrate(10);
}

/** Medium tap — shutter press, generate button */
export function hapticMedium() {
  vibrate(25);
}

/** Heavy tap — order confirm, big moments */
export function hapticHeavy() {
  vibrate([30, 50, 30]);
}

/** Success pattern — payment confirmed, sticker revealed */
export function hapticSuccess() {
  vibrate([15, 80, 15, 80, 30]);
}
