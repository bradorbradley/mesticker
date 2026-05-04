import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy · MeSticker",
  description: "How MeSticker handles your photos, data, and orders.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-primary font-semibold mb-6"
      >
        <ArrowLeft size={14} /> Back to MeSticker
      </Link>

      <h1 className="font-display text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated May 2026</p>

      <div className="prose prose-sm max-w-none space-y-4 text-sm">
        <h2 className="font-bold text-base">What we collect</h2>
        <p>
          When you use MeSticker, we collect: the photo you upload (to generate your sticker),
          the cartoon images we generate, your shipping address (only when you place an order),
          your email address (only if you give it to us), and standard analytics like page views
          and clicks.
        </p>

        <h2 className="font-bold text-base">How we use it</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>Your photo is sent to OpenAI to generate the cartoon. It is not used to train any model.</li>
          <li>The generated stickers are stored in our cart so you can revisit them.</li>
          <li>Your shipping address is used only to fulfill your order through Printful.</li>
          <li>Your email is used only for order receipts and the things you opt in to.</li>
          <li>We use PostHog to track funnel events. No raw photos are sent to PostHog.</li>
        </ul>

        <h2 className="font-bold text-base">What we don&apos;t do</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>We don&apos;t sell your data.</li>
          <li>We don&apos;t share your photos with anyone except the AI provider that generates the cartoons.</li>
          <li>We don&apos;t train AI models on your photos.</li>
        </ul>

        <h2 className="font-bold text-base">Your rights</h2>
        <p>
          You can request deletion of your data, including past creations and orders, by emailing
          <Link href="/contact" className="text-primary font-semibold"> us</Link>.
          We&apos;ll remove everything within 14 days.
        </p>

        <h2 className="font-bold text-base">Third parties</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li><strong>OpenAI</strong> — image generation</li>
          <li><strong>Stripe</strong> — payment processing (your card details never touch our servers)</li>
          <li><strong>Printful</strong> — sticker printing and shipping</li>
          <li><strong>Vercel</strong> — hosting and image storage</li>
          <li><strong>PostHog</strong> — anonymized product analytics</li>
        </ul>

        <h2 className="font-bold text-base">Cookies</h2>
        <p>
          We use a session cookie to remember your cart and a localStorage entry for your gallery.
          No third-party tracking cookies.
        </p>

        <h2 className="font-bold text-base">Contact</h2>
        <p>
          Questions? <Link href="/contact" className="text-primary font-semibold">Get in touch</Link>.
        </p>
      </div>
    </main>
  );
}
