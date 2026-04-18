"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe, Stripe, StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Loader2, AlertCircle, Truck, ChevronDown } from "lucide-react";
import { ShippingAddress } from "@/types";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise: Promise<Stripe | null> = publishableKey
  ? loadStripe(publishableKey)
  : Promise.resolve(null);

interface PaymentFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

/** Post address + paymentIntentId to our confirm endpoint for Printful fulfillment */
function confirmOrder(paymentIntentId: string, shippingAddress: ShippingAddress) {
  return fetch("/api/order/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentIntentId, shippingAddress }),
  }).catch((err) => console.error("Order confirm call failed:", err));
}

function CheckoutForm({ amount, onSuccess, onError }: Omit<PaymentFormProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [expressAvailable, setExpressAvailable] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // Shipping address state (for card payments only)
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

  // Handle Express Checkout (Apple Pay / Google Pay / Link)
  const handleExpressConfirm = useCallback(
    async (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements) return;

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}?payment=success`,
        },
        redirect: "if_required",
      });

      if (error) {
        onError(error.message || "Payment failed");
      } else if (paymentIntent?.status === "succeeded") {
        // Extract shipping address from the wallet
        const walletAddr = event.shippingAddress;
        const shippingAddress: ShippingAddress = {
          name: walletAddr?.name || "",
          address1: walletAddr?.address?.line1 || "",
          address2: walletAddr?.address?.line2 || "",
          city: walletAddr?.address?.city || "",
          stateCode: walletAddr?.address?.state || "",
          countryCode: walletAddr?.address?.country || "US",
          zip: walletAddr?.address?.postal_code || "",
        };
        confirmOrder(paymentIntent.id, shippingAddress);
        onSuccess();
      }
    },
    [stripe, elements, onSuccess, onError]
  );

  // Handle manual card payment
  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !cardReady) return;

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
      } else if (paymentIntent?.status === "succeeded") {
        confirmOrder(paymentIntent.id, address);
        onSuccess();
      } else {
        onError("Payment was not completed. Please try again.");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Payment error:", err);
      onError(err instanceof Error ? err.message : "Payment failed unexpectedly");
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Express Checkout — Apple Pay / Google Pay / Link */}
      <div>
        <ExpressCheckoutElement
          onConfirm={handleExpressConfirm}
          onReady={({ availablePaymentMethods }) => {
            setExpressAvailable(
              !!availablePaymentMethods &&
              Object.values(availablePaymentMethods).some(Boolean)
            );
          }}
          options={{
            paymentMethods: {
              applePay: "always",
              googlePay: "always",
              link: "auto",
            },
            shippingAddressRequired: true,
            phoneNumberRequired: true,
            layout: { maxColumns: 1, maxRows: 3 },
            buttonType: {
              applePay: "buy",
              googlePay: "buy",
            },
          }}
        />
      </div>

      {/* Divider */}
      {expressAvailable && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" />
          <span>or pay with card</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Card form toggle (if express is available, collapse by default) */}
      {expressAvailable && !showCardForm ? (
        <button
          type="button"
          onClick={() => setShowCardForm(true)}
          className="w-full py-3 rounded-xl text-sm font-medium text-muted-foreground border border-border flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors"
        >
          Pay with card
          <ChevronDown size={14} />
        </button>
      ) : (
        <form onSubmit={handleCardSubmit} autoComplete="on">
          {/* Shipping Address */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck size={16} /> Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  value={address.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="address1">Address</Label>
                <Input
                  id="address1"
                  name="address-line1"
                  autoComplete="address-line1"
                  required
                  value={address.address1}
                  onChange={(e) => updateField("address1", e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div>
                <Label htmlFor="address2">Apt / Suite (optional)</Label>
                <Input
                  id="address2"
                  name="address-line2"
                  autoComplete="address-line2"
                  value={address.address2}
                  onChange={(e) => updateField("address2", e.target.value)}
                  placeholder="Apt 4B"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    autoComplete="address-level2"
                    required
                    value={address.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="New York"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    autoComplete="address-level1"
                    required
                    value={address.stateCode}
                    onChange={(e) => updateField("stateCode", e.target.value)}
                    placeholder="NY"
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    name="postal-code"
                    autoComplete="postal-code"
                    required
                    value={address.zip}
                    onChange={(e) => updateField("zip", e.target.value)}
                    placeholder="10001"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    autoComplete="country"
                    value={address.countryCode}
                    onChange={(e) => updateField("countryCode", e.target.value)}
                    placeholder="US"
                    maxLength={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card Payment */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock size={16} /> Card Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!cardReady && !cardError && (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Loading...
                </div>
              )}
              {cardError && (
                <p className="text-sm text-red-500 text-center py-4">{cardError}</p>
              )}
              <div className={cardReady ? "" : "sr-only"}>
                <PaymentElement
                  onReady={() => setCardReady(true)}
                  onLoadError={(e) =>
                    setCardError(e.error?.message || "Failed to load payment form")
                  }
                  options={{
                    wallets: { applePay: "never", googlePay: "never" },
                  }}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full mt-4"
                disabled={!stripe || !cardReady || isProcessing}
              >
                {isProcessing ? "Processing..." : `Pay $${(amount / 100).toFixed(2)}`}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}

export default function PaymentForm(props: PaymentFormProps) {
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
      <CheckoutForm
        amount={props.amount}
        onSuccess={props.onSuccess}
        onError={props.onError}
      />
    </Elements>
  );
}
