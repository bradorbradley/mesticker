import Link from "next/link";
import { ArrowRight, Sparkles, Truck, Star, Heart, Gift, Package, Camera } from "lucide-react";
import HowItWorks from "@/components/how-it-works";
import ImageRevealSlider from "@/components/image-reveal";

export const metadata = {
  title: "Custom Pet Stickers from your photo · MeSticker",
  description:
    "Turn a photo of your dog or cat into a custom cartoon sticker sheet. 6 stickers per sheet, kiss-cut, ships free in the US. Made in 30 seconds.",
  openGraph: {
    title: "Custom Pet Stickers · MeSticker",
    description: "Your pet as a cartoon. Six stickers per sheet, ships free.",
    images: ["/og-image.png"],
  },
};

const PHOTO = "/landing/pets/photo.jpg";
const CARTOON = "/landing/pets/cartoon.png";

const FAQS = [
  {
    q: "What if the photo angle is weird?",
    a: "Front-facing or 3/4 angle works best. If the result isn't great, you can try again — your photo is remembered, just pick a different style and generate again.",
  },
  {
    q: "How long until they arrive?",
    a: "3–5 business days anywhere in the US. Free shipping on every order. International shipping rates shown at checkout.",
  },
  {
    q: "What's a kiss-cut sticker?",
    a: "The vinyl is cut so the sticker peels off cleanly but the backing stays as one piece. Easy to peel, doesn't curl, doesn't tear.",
  },
  {
    q: "Will it look like my actual pet?",
    a: "Yes — the AI keeps key features like fur color, ear shape, and markings. It's a stylized cartoon version, not a photo, so expect cute, not realistic.",
  },
  {
    q: "Can I order multiple sheets?",
    a: "$14.99 for the first sheet, $9.99 for each additional. Add as many as you want to your cart before checking out.",
  },
  {
    q: "Can I get my refund if I don't like it?",
    a: "Because every sticker is custom-printed, we don't offer buyer's-remorse refunds. We do replace damaged or misprinted sheets for free — see our refund policy.",
  },
];

export default function PetsPage() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-background via-background to-primary/5">
      <div className="mx-auto max-w-md px-6 py-8 flex flex-col gap-10">
        {/* Brand wordmark */}
        <Link
          href="/"
          className="font-display text-2xl font-bold gradient-text text-center"
        >
          MeSticker
        </Link>

        {/* HERO */}
        <section className="flex flex-col gap-5 text-center">
          <p className="text-xs uppercase tracking-widest text-primary font-bold">
            For pet parents
          </p>
          <h1 className="font-display text-[2.5rem] leading-[1.05] font-bold tracking-tight">
            Your pet,{" "}
            <span className="gradient-text">forever cute</span>,{" "}
            on every water bottle.
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Snap a photo. We turn them into a custom cartoon sheet of 6 kiss-cut
            stickers. Shipped to your door in 3–5 days.
          </p>

          {/* Hero reveal */}
          <div className="rounded-3xl overflow-hidden shadow-card border-4 border-white">
            <ImageRevealSlider
              beforeSrc={PHOTO}
              afterSrc={CARTOON}
              height={340}
            />
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Drag the handle ← → to see the magic
          </p>

          <Link
            href="/?source=pets"
            className="w-full py-4 rounded-2xl font-bold text-base btn-gradient shadow-glow flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            Make my pet&apos;s stickers
            <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-3 -mt-2">
            <span className="flex items-center gap-1">
              <Truck size={12} /> Free US shipping
            </span>
            <span>·</span>
            <span>3–5 days</span>
            <span>·</span>
            <span>$14.99/sheet</span>
          </p>
        </section>

        {/* HOW IT WORKS */}
        <section>
          <HowItWorks
            photoSrc={PHOTO}
            cartoonSrc={CARTOON}
            sheetSrc={CARTOON}
            label1="Snap photo"
            label2="Cartoon-ified"
            label3="Ships to you"
          />
        </section>

        {/* WHAT YOU GET */}
        <section className="rounded-3xl border border-border bg-card p-6 flex flex-col gap-4 shadow-card">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-primary" />
            <h2 className="font-display text-xl font-bold">What lands in your mailbox</h2>
          </div>
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-2">
              <Star size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong>One kiss-cut sticker sheet,</strong> 5.83″ × 8.27″, with 6 copies of your pet
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Star size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong>Premium white vinyl</strong> — waterproof, dishwasher-safe, won&apos;t curl or fade
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Star size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong>Peel-and-stick backing</strong> — easy to peel one at a time, leave the rest on the sheet
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Star size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <span>
                <strong>Free US shipping</strong>, tracked, arrives in 3–5 business days
              </span>
            </li>
          </ul>
        </section>

        {/* USE CASES */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-center">Perfect for…</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Camera, title: "Water bottles", body: "Cover your Hydro Flask" },
              { icon: Heart, title: "Laptops", body: "Personality at every coffee shop" },
              { icon: Gift, title: "Gifts for dog people", body: "$14.99 = thoughtful gift" },
              { icon: Package, title: "Goody bags", body: "Birthday parties, meetups" },
            ].map(({ icon: Icon, title, body }, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card/50 p-4 flex flex-col gap-1.5"
              >
                <Icon size={18} className="text-primary" />
                <p className="text-sm font-bold">{title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING */}
        <section className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-6 flex flex-col gap-3 shadow-card text-center">
          <h2 className="font-display text-xl font-bold">Simple pricing</h2>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl font-display font-bold gradient-text">$14.99</span>
            <span className="text-sm text-muted-foreground">/ first sheet</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Each additional sheet only <strong className="text-foreground">$9.99</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Free US shipping · Free worldwide on orders $35+
          </p>
        </section>

        {/* FAQ */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-center">Common questions</h2>
          <div className="flex flex-col gap-2">
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="rounded-2xl border border-border bg-card/50 p-4 group"
              >
                <summary className="cursor-pointer text-sm font-bold flex items-center justify-between gap-2 list-none">
                  {faq.q}
                  <span className="text-primary text-xl leading-none group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* TESTIMONIAL */}
        <section className="rounded-3xl border-l-4 border-primary bg-primary/5 p-6 italic text-sm">
          <p>
            &ldquo;I made one of my golden retriever and now I&apos;m making one for every dog I know.
            They&apos;re addictive.&rdquo;
          </p>
          <p className="text-xs text-muted-foreground mt-2 not-italic font-semibold">
            — Verified MeSticker customer
          </p>
        </section>

        {/* CLOSING CTA */}
        <section className="text-center flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold leading-tight">
            Your pet on a sticker.
            <br />
            In your hand by next week.
          </h2>
          <Link
            href="/?source=pets"
            className="w-full py-4 rounded-2xl font-bold text-base btn-gradient shadow-glow flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            Start with a photo
            <ArrowRight size={16} />
          </Link>
          <p className="text-[11px] text-muted-foreground">
            About 30 seconds. No sign-up. Free shipping.
          </p>
        </section>
      </div>
    </main>
  );
}
