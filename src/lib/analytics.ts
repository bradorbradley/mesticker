import posthog from "posthog-js";

/**
 * Track key funnel events for MeSticker.
 *
 * Funnel: Landing -> Capture -> Style Grid -> Generate -> Reveal -> Order/Variations -> Payment
 */

// Existing events (preserved)
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

// New events for Sprint 1

export function trackStyleGridViewed() {
  posthog.capture("style_grid_viewed");
}

export function trackCustomPromptOpened() {
  posthog.capture("custom_prompt_opened");
}

export function trackCustomPromptSubmitted(promptLength: number) {
  posthog.capture("custom_prompt_submitted", { promptLength });
}

export function trackCustomPromptRejected(reason: string) {
  posthog.capture("custom_prompt_rejected", { reason });
}

export function trackRevealViewed() {
  posthog.capture("reveal_viewed");
}

export function trackOrderClicked() {
  posthog.capture("order_clicked");
}

export function trackVariationsClicked() {
  posthog.capture("variations_clicked");
}

export function trackTryAnotherClicked() {
  posthog.capture("try_another_clicked");
}

export function trackVariationsStarted() {
  posthog.capture("variations_generation_started");
}

export function trackVariationTileLoaded(index: number, latency: number) {
  posthog.capture("variations_tile_loaded", { index, latency });
}

export function trackVariationsComplete(totalLatency: number) {
  posthog.capture("variations_complete", { totalLatency });
}

export function trackVariationTileSelected(index: number) {
  posthog.capture("variations_tile_selected", { index });
}

export function trackVariationTileRegenerated(index: number) {
  posthog.capture("variations_tile_regenerated", { index });
}

export function trackVarietyPackBuilt(count: number) {
  posthog.capture("variety_pack_built", { count });
}

export function trackSkuSelected(skuId: string) {
  posthog.capture("sku_selected", { skuId });
}
