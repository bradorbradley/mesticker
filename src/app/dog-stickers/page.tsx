import Link from "next/link";
import { ArrowRight, Sparkles, Truck, Star } from "lucide-react";
import HowItWorks from "@/components/how-it-works";
import ImageRevealSlider from "@/components/image-reveal";

export const metadata = {
  title: "Custom Dog Stickers from your photo · MeSticker",
  description:
    "Turn a photo of your dog into a custom cartoon sticker sheet. 6 stickers per sheet, kiss-cut, ships free in the US. Made in 30 seconds.",
  openGraph: {
    title: "Custom Dog Stickers · MeSticker",
    description: "Your dog as a cartoon. Six stickers per sheet, ships free.",
    images: ["/og-image.png"],
  },
};

// Drop your generated assets at these paths and the page picks them up.
// Photo:    /public/landing/dog/photo.jpg  (a real dog photo)
// Cartoon:  /public/landing/dog/cartoon.png (chibi-style cartoon dog)
// Sheet:    /public/landing/dog/sheet.png  (composed 6-up sheet preview)
//
// Falls back to existing preset images until you upload yours.
const DOG_PHOTO = "/landing/dog/photo.jpg";
const DOG_CARTOON = "/landing/dog/cartoon.png";
const DOG_SHEET = "/landing/dog/sheet.png";

export default function DogStickersPage() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-background via-background to-primary/5">
      <div className="mx-auto max-w-md px-6 py-10 flex flex-col gap-8">
        {/* Brand wordmark */}
        <Link
          href="/"
          className="font-display text-2xl font-bold gradient-text text-center"
        >
          MeSticker
        </Link>

        {/* Hero */}
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold leading-tight">
            Your dog deserves to be on every water bottle.
          </h1>
          <p className="text-base text-muted-foreground mt-3">
            Snap a photo. Get a sheet of 6 custom cartoon stickers of your dog.
            Made in 30 seconds, shipped free.
          </p>
        </div>

        {/* Primary CTA */}
        <div>
          <Link
            href="/?source=dog"
            className="w-full py-4 rounded-2xl font-bold text-base btn-gradient shadow-glow flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            Make my dog&apos;s stickers
            <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-center text-muted-foreground mt-2 flex items-center justify-center gap-3">
            <span className="flex items-center gap-1">
              <Truck size={12} /> Free US shipping
            </span>
            <span>·</span>
            <span>3–5 days</span>
            <span>·</span>
            <span>$14.99/sheet</span>
          </p>
        </div>

        {/* How it works — 3 step visual */}
        <HowItWorks
          photoSrc={DOG_PHOTO}
          cartoonSrc={DOG_CARTOON}
          sheetSrc={DOG_SHEET}
          label1="Upload photo"
          label2="Get cartoon"
          label3="Order sheet"
        />

        {/* Reveal slider — drag to see photo → cartoon */}
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-bold text-center">
            Drag to see the magic
          </h2>
          <ImageRevealSlider
            beforeSrc={DOG_PHOTO}
            afterSrc={DOG_CARTOON}
            height={320}
          />
          <p className="text-xs text-muted-foreground text-center">
            Real photo on the left. Cartoon sticker on the right.
          </p>
        </div>

        {/* Bullets */}
        <ul className="rounded-2xl border border-border bg-card/50 p-5 flex flex-col gap-3">
          <li className="flex items-start gap-2 text-sm">
            <Star size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <span>Upload one photo — we turn it into a chibi-style cartoon dog</span>
          </li>
          <li className="flex items-start gap-2 text-sm">
            <Star size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <span>Sheet of 6 kiss-cut stickers, 5.83″ × 8.27″</span>
          </li>
          <li className="flex items-start gap-2 text-sm">
            <Star size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <span>
              Perfect for water bottles, laptops, journals, gifts for fellow dog
              parents
            </span>
          </li>
          <li className="flex items-start gap-2 text-sm">
            <Star size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <span>Free US shipping · arrives in 3–5 days · $14.99</span>
          </li>
        </ul>

        {/* Testimonial */}
        <blockquote className="rounded-2xl border-l-4 border-primary bg-primary/5 p-5 italic text-sm">
          <p>
            &ldquo;I made one of my golden retriever and now I&apos;m making
            one for every dog I know. They&apos;re addictive.&rdquo;
          </p>
          <p className="text-xs text-muted-foreground mt-2 not-italic font-semibold">
            — Verified MeSticker customer
          </p>
        </blockquote>

        {/* Secondary CTA */}
        <div className="text-center">
          <Link
            href="/?source=dog"
            className="inline-flex items-center gap-2 text-primary font-bold text-sm hover:underline"
          >
            Start making yours now <ArrowRight size={14} />
          </Link>
          <p className="text-[11px] text-muted-foreground mt-1">
            Takes about 30 seconds. No sign-up.
          </p>
        </div>
      </div>
    </main>
  );
}
