import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export const metadata = {
  title: "Contact · MeSticker",
  description: "Get in touch with MeSticker support.",
};

export default function ContactPage() {
  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-primary font-semibold mb-6"
      >
        <ArrowLeft size={14} /> Back to MeSticker
      </Link>

      <h1 className="font-display text-3xl font-bold mb-2">Contact</h1>
      <p className="text-sm text-muted-foreground mb-8">
        We&apos;re a small team and we read everything.
      </p>

      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Mail size={20} className="text-primary" />
        </div>
        <div>
          <p className="font-bold">Email us</p>
          <a
            href="mailto:hello@mesticker.fun"
            className="text-primary font-semibold text-lg hover:underline"
          >
            hello@mesticker.fun
          </a>
          <p className="text-xs text-muted-foreground mt-2">
            Order issues, replacements, partnerships, press, or feedback. We respond within
            2 business days.
          </p>
        </div>
      </div>

      <div className="mt-6 text-xs text-muted-foreground space-y-1">
        <p>For order issues, please include your order number and a photo of the issue.</p>
        <p>For account or data deletion requests, see our <Link href="/privacy" className="text-primary font-semibold">privacy policy</Link>.</p>
      </div>
    </main>
  );
}
