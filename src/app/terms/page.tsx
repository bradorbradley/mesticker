import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service · MeSticker",
  description: "MeSticker terms of service.",
};

export default function TermsPage() {
  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-primary font-semibold mb-6"
      >
        <ArrowLeft size={14} /> Back to MeSticker
      </Link>

      <h1 className="font-display text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated May 2026</p>

      <div className="space-y-4 text-sm">
        <h2 className="font-bold text-base">Using MeSticker</h2>
        <p>
          MeSticker turns photos you upload into cartoon-style stickers and ships physical stickers
          to the address you provide at checkout. By using the service you agree to these terms.
        </p>

        <h2 className="font-bold text-base">What you upload</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>You must own the rights to any photo you upload, or have permission from the people in it.</li>
          <li>No content depicting illegal activity, sexual material involving minors, or hate symbols.</li>
          <li>We may decline to fulfill orders that violate these rules and refund the purchase.</li>
        </ul>

        <h2 className="font-bold text-base">What we make</h2>
        <p>
          MeSticker generates a cartoon-style image based on your photo and prints it as a kiss-cut
          sticker sheet (5.83&quot; × 8.27&quot;). What you see in the on-screen preview is what we send to
          our print partner; minor color or alignment variation between screens and physical print
          is normal.
        </p>

        <h2 className="font-bold text-base">Pricing &amp; orders</h2>
        <ul className="list-disc ml-5 space-y-1">
          <li>Prices in USD. Free shipping in the US. International shipping rates shown at checkout.</li>
          <li>Once payment is confirmed, your order goes to print and cannot be canceled.</li>
          <li>See our <Link href="/refunds" className="text-primary font-semibold">refund policy</Link> for damages or print errors.</li>
        </ul>

        <h2 className="font-bold text-base">IP &amp; ownership</h2>
        <p>
          You keep ownership of your original photo. The cartoon image we generate is yours to
          use for personal purposes. Commercial resale of MeSticker designs requires written
          permission.
        </p>

        <h2 className="font-bold text-base">Liability</h2>
        <p>
          MeSticker is provided as-is. We&apos;re not liable for indirect damages. Our maximum
          liability for any claim is the amount you paid for the order in question.
        </p>

        <h2 className="font-bold text-base">Changes</h2>
        <p>
          We may update these terms. We&apos;ll show the &quot;Last updated&quot; date above when we do.
        </p>

        <h2 className="font-bold text-base">Contact</h2>
        <p>
          <Link href="/contact" className="text-primary font-semibold">Get in touch</Link>.
        </p>
      </div>
    </main>
  );
}
