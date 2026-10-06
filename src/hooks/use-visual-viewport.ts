"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the visible part of the screen (window.visualViewport).
 *
 * iOS Safari overlays the on-screen keyboard on top of position:fixed
 * elements instead of resizing them, so a bottom sheet ends up hidden
 * behind the keyboard. Sizing the overlay to the visual viewport keeps
 * the sheet (and its input) sitting just above the keyboard.
 *
 * Returns null when inactive or unsupported, so callers fall back to CSS.
 */
export function useVisualViewport(active: boolean) {
  const [rect, setRect] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) {
      setRect(null);
      return;
    }
    const update = () => setRect({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);

  return rect;
}
