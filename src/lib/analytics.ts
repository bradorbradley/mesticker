import posthog from "posthog-js";

/**
 * Track key funnel events for MeSticker.
 * 
 * Funnel: Landing → Capture → Style Select → Generate → Reveal → Order → Payment
 */

export function trackCapture() {
  posthog.capture("photo_captured");
}

export function trackStyleSelect(styleId: string) {
  posthog.capture("style_selected", { style: styleId });
}

export function trackGenerateStart(styleId: string) {
  posthog.capture("generate_started", { style: styleId });
}

export function trackGenerateComplete(styleId: string) {
  posthog.capture("generate_completed", { style: styleId });
}

export function trackGenerateError(error: string) {
  posthog.capture("generate_error", { error });
}

export function trackAddToCart(styleId: string) {
  posthog.capture("added_to_cart", { style: styleId });
}

export function trackCheckoutStart() {
  posthog.capture("checkout_started");
}

export function trackPaymentComplete(amount: number, quantity: number) {
  posthog.capture("payment_completed", {
    amount_cents: amount,
    quantity,
    revenue: amount / 100,
  });
}

export function trackLimitReached() {
  posthog.capture("generation_limit_reached");
}

export function trackEmailCapture() {
  posthog.capture("email_captured");
}

export function trackImageDownload() {
  posthog.capture("image_downloaded");
}

export function trackImageShare() {
  posthog.capture("image_shared");
}
