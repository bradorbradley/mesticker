import Link from "next/link";
import { ArrowRight, Camera, Clock, Heart, Printer, QrCode, Smartphone, Sparkles, Users } from "lucide-react";
import ImageRevealSlider from "@/components/image-reveal";
import InquiryForm from "@/components/events/inquiry-form";

export const metadata = {
  title: "MeSticker for Events · Live AI Sticker Booth",
  description:
    "Book MeSticker for your wedding, party or brand event. Guests snap a photo, become a cartoon, and walk away with a sheet of real stickers printed and cut on the spot.",
  openGraph: {
    title: "MeSticker for Events · Live AI Sticker Booth",
    description: "Guests snap a photo and walk away with 12 cartoon stickers of themselves, printed on the spot.",
    images: ["/og-image.png"],
  },
};

const STEPS = [
  { icon: Camera, title: "Snap", body: "Guests take a photo at the booth, or scan a QR code and use their own phone." },
  { icon: Sparkles, title: "Become a cartoon", body: "In about 15 seconds they see themselves as a chibi character, plus sheets of poses and expressions." },
  { icon: Printer, title: "Peel & stick", body: "Each 12-sticker sheet prints and cuts right there in about 2 minutes. They play a game while it prints." },
];

const OCCASIONS = ["Weddings", "Birthday parties", "Bar & Bat Mitzvahs", "Corporate parties & offsites", "Brand activations & pop-ups", "School & community events", "Holiday parties", "Conferences"];

const INCLUDED = [
  { icon: Printer, text: "The booth: touchscreen, camera and a pro print-and-cut sticker printer" },
  { icon: Users, text: "A friendly attendant who runs everything" },
  { icon: Sparkles, text: "All the sticker paper and ink" },
  { icon: Smartphone, text: "Digital copies guests can save to their phone" },
  { icon: QrCode, text: "Guests can also join from their own phone with a QR code" },
  { icon: Heart, text: "Ask about custom branding: your logo, names or date on every sheet" },
];

const FAQS = [
  { q: "How much does it cost?", a: "It depends on your guest count, how many hours you'd like the booth and where the event is. Tell us about it with the form below and we'll send a quote within 1–2 business days." },
  { q: "Who pays for the stickers?", a: "Your choice. You can cover it so every guest gets stickers free, or guests can buy their own sheets on their phones (Apple Pay, Google Pay, card) while you pay a smaller booking fee." },
  { q: "How many guests can it handle?", a: "Each sheet takes about 2 minutes to print and cut, so roughly 25 sheets an hour. Guests get their cartoon in seconds and play a game while their sheet prints, so the line keeps moving." },
  { q: "What do you need from the venue?", a: "A table about 6 ft wide, a power outlet and Wi-Fi (we can bring a hotspot). Setup takes about 30 minutes." },
  { q: "What does a sheet look like?", a: "Twelve kiss-cut stickers on a 4×7\" sheet: a big hero sticker of the guest plus poses or expressions. Guests can pick up to three different sheets." },
  { q: "Can we try it first?", a: "Yes. Make your own cartoon stickers online right now and see what your guests will get." },
];

export default function EventsPage() {
  return (
    <main className="min-h-dvh">
      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-12 pt-10 md:grid-cols-2 md:pt-16">
        <div>
          <Link href="/" className="font-display text-lg font-bold gradient-text">
            MeSticker
          </Link>
          <p className="mt-8 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-semibold text-primary">Now booking events</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight md:text-6xl" style={{ textWrap: "balance" }}>
            A live AI sticker booth for <span className="gradient-text">your event</span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg text-muted-foreground">
            Guests snap a photo, turn into a cartoon, and walk away with a sheet of real stickers of themselves, printed and cut on the spot.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#book" className="flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-lg font-bold text-white shadow-lg transition-transform hover:scale-[1.02]">
              Book MeSticker <ArrowRight size={20} />
            </a>
            <Link href="/" className="rounded-full border-2 border-primary/30 px-7 py-4 text-lg font-bold text-primary hover:bg-primary/5">
              Try it yourself
            </Link>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock size={16} /> About 2 minutes from photo to stickers in hand
          </p>
        </div>
        <div className="mx-auto w-full max-w-md">
          <ImageRevealSlider beforeSrc="/presets/hero-before.jpg" afterSrc="/presets/hero-after.jpg" altBefore="Photo" altAfter="Sticker" height={440} className="!rounded-[28px] border-[6px] border-white shadow-xl" />
          <p className="mt-3 text-center text-sm text-muted-foreground">Drag to see the magic</p>
        </div>
      </section>

      {/* how it works */}
      <section className="bg-primary/5 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl font-bold md:text-4xl">How it works at your event</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display font-bold text-white">{i + 1}</span>
                  <s.icon className="text-primary" size={22} />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* occasions + included */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-bold">Perfect for</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <span key={o} className="rounded-full border-2 border-primary/20 bg-white px-4 py-2 font-semibold">
                {o}
              </span>
            ))}
          </div>
          <p className="mt-6 text-muted-foreground">
            It&apos;s the photo booth guests actually take home: stickers end up on laptops, water bottles and phone cases long after the party.
          </p>
        </div>
        <div>
          <h2 className="font-display text-3xl font-bold">What&apos;s included</h2>
          <ul className="mt-6 grid gap-3">
            {INCLUDED.map((i) => (
              <li key={i.text} className="flex items-start gap-3">
                <i.icon className="mt-0.5 shrink-0 text-primary" size={20} />
                <span>{i.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* pricing */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-pink-500 p-8 text-white md:p-10">
          <h2 className="font-display text-3xl font-bold">Pricing</h2>
          <p className="mt-3 max-w-[60ch] text-lg text-white/90">
            Every event is a little different, so pricing depends on your guest count, how many hours you&apos;d like and where you are. Tell us about your
            event and we&apos;ll send a quote within 1–2 business days.
          </p>
          <a href="#book" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-primary">
            Get a quote <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* inquiry form */}
      <section id="book" className="mx-auto max-w-3xl scroll-mt-6 px-6 py-14">
        <h2 className="font-display text-3xl font-bold md:text-4xl">Book MeSticker for your event</h2>
        <p className="mb-8 mt-2 text-muted-foreground">Tell us a bit about it. Only your name and email are required.</p>
        <InquiryForm />
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 pb-6">
        <h2 className="font-display text-3xl font-bold">Questions</h2>
        <div className="mt-6 divide-y divide-border rounded-3xl border-2 border-border bg-white">
          {FAQS.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none font-semibold">
                <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-45">+</span>
                {f.q}
              </summary>
              <p className="mt-2 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 rounded-3xl bg-primary/5 p-8 text-center">
          <h3 className="font-display text-2xl font-bold">See it for yourself</h3>
          <p className="mt-2 text-muted-foreground">Make your own cartoon stickers online in about 30 seconds.</p>
          <Link href="/" className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-bold text-white">
            Try MeSticker <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
