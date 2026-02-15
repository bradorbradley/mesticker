"use client";

import { useState, useEffect } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Loader2, AlertCircle } from "lucide-react";

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

function CheckoutForm({ amount, onSuccess, onError }: Omit<PaymentFormProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [elementError, setElementError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !elementReady) return;

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
      console.error("Payment confirmation error:", err);
      onError(err instanceof Error ? err.message : "Payment failed unexpectedly");
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock size={16} /> Payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!elementReady && !elementError && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading payment form...
            </div>
          )}
          {elementError && (
            <p className="text-sm text-red-500 text-center py-4">
              {elementError}
            </p>
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
            className="w-full mt-4"
            disabled={!stripe || !elementReady || isProcessing}
          >
            {isProcessing ? "Processing..." : `Pay $${(amount / 100).toFixed(2)}`}
          </Button>
        </CardContent>
      </Card>
    </form>
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
