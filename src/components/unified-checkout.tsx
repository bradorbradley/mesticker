"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe, Stripe, StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertCircle, Truck, Mail, ChevronDown, ChevronUp } from "lucide-react";
import {
  getTier,
  getShipping,
  formatPrice,
} from "@/lib/pricing";
import {
  trackExpressCheckoutShown,
  trackExpressCheckoutClicked,
  trackCardFormOpened,
} from "@/lib/analytics";
import type { CartItem, ShippingAddress } from "@/types";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise: Promise<Stripe | null> = publishableKey
  ? loadStripe(publishableKey)
  : Promise.resolve(null);

interface UnifiedCheckoutProps {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  cartItems: CartItem[];
  onSuccess: () => void;
  onError: (error: string) => void;
  /** When true, hides the duplicate cart-summary card (parent already shows total) */
  compact?: boolean;
}

function CheckoutInner({
  paymentIntentId,
  amount,
  cartItems,
  onSuccess,
  onError,
  compact,
}: Omit<UnifiedCheckoutProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [elementError, setElementError] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [expressAvailable, setExpressAvailable] = useState(true);

  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<ShippingAddress>({
    name: "",
    address1: "",
    address2: "",
    city: "",
    stateCode: "",
    countryCode: "US",
    zip: "",
  });

  const updateField = (field: keyof ShippingAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const patchMetadata = useCallback(
    async (patchEmail?: string, patchAddress?: ShippingAddress) => {
      try {
        await fetch("/api/order", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId,
            email: patchEmail,
            address: patchAddress,
          }),
        });
      } catch (err) {
        console.error("Failed to patch PI metadata:", err);
      }
    },
    [paymentIntentId]
  );

  const handleExpressConfirm = useCallback(
    async (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements) return;
      trackExpressCheckoutClicked("express");

      console.log("[express-checkout] confirm event:", {
        expressPaymentType: event.expressPaymentType,
        hasShippingAddress: !!event.shippingAddress,
        hasBillingDetails: !!event.billingDetails,
      });

      const walletAddress = event.shippingAddress;
      const billingDetails = event.billingDetails;

      if (walletAddress || billingDetails) {
        const addr: ShippingAddress = {
          name: billingDetails?.name || walletAddress?.name || "",
          address1: walletAddress?.address?.line1 || billingDetails?.address?.line1 || "",
          address2: walletAddress?.address?.line2 || billingDetails?.address?.line2 || "",
          city: walletAddress?.address?.city || billingDetails?.address?.city || "",
          stateCode: walletAddress?.address?.state || billingDetails?.address?.state || "",
          countryCode: walletAddress?.address?.country || billingDetails?.address?.country || "US",
          zip: walletAddress?.address?.postal_code || billingDetails?.address?.postal_code || "",
        };
        const walletEmail = billingDetails?.email || "";
        await patchMetadata(walletEmail, addr);
      } else {
        console.warn("[express-checkout] no shipping/billing in event — Printful submission will fail without an address");
      }

      setIsProcessing(true);
      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}?payment=success`,
          },
          redirect: "if_required",
        });

        if (error) {
          console.error("[express-checkout] confirmPayment error:", error);
          onError(error.message || `Payment failed (${error.code || "unknown"})`);
          setIsProcessing(false);
        } else if (paymentIntent && paymentIntent.status === "succeeded") {
          console.log("[express-checkout] payment succeeded:", paymentIntent.id);
          onSuccess();
        } else {
          console.warn("[express-checkout] payment did not succeed:", paymentIntent?.status);
          onError(`Payment status: ${paymentIntent?.status || "unknown"}. Please try again.`);
          setIsProcessing(false);
        }
      } catch (err) {
        console.error("[express-checkout] confirmPayment threw:", err);
        onError(err instanceof Error ? err.message : "Payment failed unexpectedly");
        setIsProcessing(false);
      }
    },
    [stripe, elements, patchMetadata, onSuccess, onError]
  );

  const handleCardSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements || !elementReady) return;

      await patchMetadata(email, address);

      setIsProcessing(true);
      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}?payment=success`,
          },
          redirect: "if_required",
        });

        if (error) {
          onError(error.message || "Payment failed");
          setIsProcessing(false);
        } else if (paymentIntent && paymentIntent.status === "succeeded") {
          onSuccess();
        } else {
          onError("Payment was not completed. Please try again.");
          setIsProcessing(false);
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : "Payment failed unexpectedly");
        setIsProcessing(false);
      }
    },
    [stripe, elements, elementReady, email, address, patchMetadata, onSuccess, onError]
  );

  const item = cartItems[0];
  const tier = item ? getTier(item.tierId) : null;
  const subtotalCents = tier?.priceCents ?? 0;
  const shippingCents = getShipping();

  const variantLabel = item?.sheetVariant === "stack" ? "Stack of Me" : "Pack of Me";
  const variantSubtitle =
    item?.sheetVariant === "stack"
      ? "6 of the same sticker per sheet"
      : "6 different poses per sheet";

  const productLabel = `${variantLabel} — ${tier?.qty ?? 0} Sheet${(tier?.qty ?? 0) > 1 ? "s" : ""}`;
  const productSubtitle = `${variantSubtitle} · ${(tier?.qty ?? 0) * 6} stickers total`;

  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item?.generatedImage || ""}
                alt="Your sticker"
                className="w-16 h-16 rounded-lg object-contain bg-muted"
              />
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm">{productLabel}</p>
                <p className="text-xs text-muted-foreground">{productSubtitle}</p>
              </div>
              <p className="font-bold text-sm">{formatPrice(subtotalCents)}</p>
            </div>

            <div className="space-y-1 text-sm border-t border-border pt-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>
                  {shippingCents === 0 ? (
                    <span className="text-green-600 font-semibold">FREE</span>
                  ) : (
                    formatPrice(shippingCents)
                  )}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-bold text-base">
                <span>Total</span>
                <span>{formatPrice(amount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock size={16} /> Quick Checkout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExpressCheckoutElement
            onConfirm={handleExpressConfirm}
            onClick={({ resolve }) => {
              // Link requires shippingRates AND lineItems to fully complete
              // its checkout drawer. Apple Pay / Google Pay tolerate fewer
              // fields but providing them gives a better UX everywhere.
              resolve({
                emailRequired: true,
                phoneNumberRequired: false,
                shippingAddressRequired: true,
                shippingRates: [
                  {
                    id: "free-us-shipping",
                    amount: 0,
                    displayName: "Free US shipping",
                    deliveryEstimate: {
                      minimum: { unit: "business_day", value: 3 },
                      maximum: { unit: "business_day", value: 5 },
                    },
                  },
                ],
                lineItems:
                  cartItems.length > 0
                    ? cartItems.map((it, idx) => ({
                        name:
                          idx === 0
                            ? "Sticker sheet"
                            : "Additional sticker sheet",
                        amount:
                          idx === 0
                            ? Math.max(0, amount - (cartItems.length - 1) * 999)
                            : 999,
                      }))
                    : [{ name: "Sticker sheet", amount }],
              });
            }}
            options={{
              buttonType: {
                applePay: "buy",
                googlePay: "buy",
              },
              paymentMethods: {
                applePay: "auto",
                googlePay: "auto",
                link: "auto",
              },
            }}
            onReady={({ availablePaymentMethods }) => {
              console.log("[express-checkout] available:", availablePaymentMethods);
              if (
                availablePaymentMethods?.applePay ||
                availablePaymentMethods?.googlePay ||
                availablePaymentMethods?.link
              ) {
                trackExpressCheckoutShown();
                setExpressAvailable(true);
              } else {
                setExpressAvailable(false);
                setShowCardForm(true);
              }
            }}
            onLoadError={(e) => {
              console.error("[express-checkout] load error:", e);
              setElementError(e.error?.message || "Express checkout failed to load");
            }}
          />
          {!expressAvailable && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Express checkout not available in this browser
            </p>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleCardSubmit}>
        <Card>
          <CardHeader className="pb-2">
            <button
              type="button"
              onClick={() => {
                setShowCardForm((v) => !v);
                if (!showCardForm) trackCardFormOpened();
              }}
              className="w-full text-left flex items-center gap-2"
            >
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2 flex-1">
                Or pay with card
              </CardTitle>
              {showCardForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </CardHeader>

          {showCardForm && (
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="checkout-email" className="flex items-center gap-1.5">
                  <Mail size={14} /> Email
                </Label>
                <Input
                  id="checkout-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="mt-1"
                />
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-1.5">
                  <Truck size={14} /> Shipping Address
                </Label>
                <Input
                  name="shipping-name"
                  autoComplete="name"
                  required
                  value={address.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Full Name"
                />
                <Input
                  name="shipping-address-line1"
                  autoComplete="address-line1"
                  required
                  value={address.address1}
                  onChange={(e) => updateField("address1", e.target.value)}
                  placeholder="Address"
                />
                <Input
                  name="shipping-address-line2"
                  autoComplete="address-line2"
                  value={address.address2}
                  onChange={(e) => updateField("address2", e.target.value)}
                  placeholder="Apt / Suite (optional)"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    name="shipping-city"
                    autoComplete="address-level2"
                    required
                    value={address.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="City"
                  />
                  <Input
                    name="shipping-state"
                    autoComplete="address-level1"
                    required
                    value={address.stateCode}
                    onChange={(e) => updateField("stateCode", e.target.value)}
                    placeholder="State"
                    maxLength={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    name="shipping-postal-code"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    required
                    value={address.zip}
                    onChange={(e) => updateField("zip", e.target.value)}
                    placeholder="ZIP Code"
                  />
                  <Input
                    name="shipping-country"
                    autoComplete="country"
                    value={address.countryCode}
                    onChange={(e) => updateField("countryCode", e.target.value)}
                    placeholder="Country"
                    maxLength={2}
                  />
                </div>
              </div>

              {!elementReady && !elementError && (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Loading payment form...
                </div>
              )}
              {elementError && (
                <p className="text-sm text-red-500 text-center py-4">{elementError}</p>
              )}
              <div className={elementReady ? "" : "sr-only"}>
                <PaymentElement
                  onReady={() => setElementReady(true)}
                  onLoadError={(e) =>
                    setElementError(e.error?.message || "Failed to load payment form")
                  }
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full mt-2"
                disabled={!stripe || !elementReady || isProcessing}
              >
                {isProcessing ? "Processing..." : `Pay ${formatPrice(amount)}`}
              </Button>
            </CardContent>
          )}
        </Card>
      </form>
    </div>
  );
}

export default function UnifiedCheckout(props: UnifiedCheckoutProps) {
  const [stripeError, setStripeError] = useState(false);

  useEffect(() => {
    stripePromise.then((s) => {
      if (!s) setStripeError(true);
    });
  }, []);

  if (stripeError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle size={16} />
            <p>Payment system unavailable. Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#6C63FF" },
        },
      }}
    >
      <CheckoutInner
        paymentIntentId={props.paymentIntentId}
        amount={props.amount}
        cartItems={props.cartItems}
        onSuccess={props.onSuccess}
        onError={props.onError}
        compact={props.compact}
      />
    </Elements>
  );
}
