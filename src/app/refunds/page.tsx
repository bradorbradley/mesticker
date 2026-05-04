import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Refund Policy · MeSticker",
  description: "MeSticker refund and replacement policy.",
};

export default function RefundsPage() {
  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-primary font-semibold mb-6"
      >
        <ArrowLeft size={14} /> Back to MeSticker
      </Link>

      <h1 className="font-display text-3xl font-bold mb-2">Refund Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated May 2026</p>

      <div className="space-y-4 text-sm">
        <h2 className="font-bold text-base">Replacements for defects</h2>
        <p>
          If your stickers arrive damaged, mis-printed, or with a manufacturing defect, we&apos;ll
          replace them free of charge. Email us within 30 days of delivery with a photo of the
          issue and we&apos;ll ship a replacement.
        </p>

        <h2 className="font-bold text-base">Lost or undelivered orders</h2>
        <p>
          If your order doesn&apos;t arrive within 14 business days of shipping, contact us and
          we&apos;ll either re-ship or refund.
        </p>

        <h2 className="font-bold text-base">Custom-made products</h2>
        <p>
          Because every sticker is custom-printed for you, we don&apos;t offer refunds for buyer&apos;s
          remorse or for the cartoon not matching your expectations. Please review your sticker
          sheet preview before completing checkout.
        </p>

        <h2 className="font-bold text-base">How to request</h2>
        <p>
          <Link href="/contact" className="text-primary font-semibold">Contact us</Link> with your
          order number and photos. We&apos;ll respond within 2 business days.
        </p>
      </div>
    </main>
  );
}
