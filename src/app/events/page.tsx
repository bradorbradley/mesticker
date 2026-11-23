import Link from "next/link";
import { ArrowRight, Camera, Clock, Heart, Printer, QrCode, Smartphone, Sparkles, Users } from "lucide-react";
import ImageRevealSlider from "@/components/image-reveal";
import InquiryForm from "@/components/events/inquiry-form";

export const metadata = {
  title: "MeSticker for Events · Cartoon Sticker Photo Booth",
  description:
    "Book the MeSticker cartoon sticker photo booth for your wedding, party or company event. Guests snap a photo, become a cartoon, and walk away with a sheet of real stickers printed and cut on the spot. Custom styles and themes for every event.",
  openGraph: {
    title: "MeSticker for Events · Cartoon Sticker Photo Booth",
    description: "Guests snap a photo and walk away with 12 cartoon stickers of themselves, printed on the spot.",
    images: ["/og-image.png"],
  },
};

const STEPS = [
  { icon: Camera, title: "Snap", body: "Guests take a photo at the booth, or scan a QR code and use their own phone." },
  { icon: Sparkles, title: "Become a cartoon", body: "In about 15 seconds they see themselves as a chibi character, plus sheets of poses and expressions." },
  { icon: Printer, title: "Peel & stick", body: "Each 12-sticker sheet prints and cuts right there in about 2 minutes. They play a game while it prints." },
];

const SHEETS = [
  { file: "/events/sheet-pose-party.webp", name: "Pose Party", emoji: "🤸", blurb: "You + 7 poses" },
  { file: "/events/sheet-big-feelings.webp", name: "Big Feelings", emoji: "😆", blurb: "You + 7 expressions" },
  { file: "/events/sheet-best-of.webp", name: "Best Of", emoji: "⭐", blurb: "A big you + the best of both" },
];

const STYLES = [
  { file: "/events/styles/chibi.webp", name: "Chibi" },
  { file: "/events/styles/pixar.webp", name: "3D animated" },
  { file: "/events/styles/simpsons.webp", name: "Yellow sitcom" },
  { file: "/events/styles/spongebob.webp", name: "Undersea cartoon" },
  { file: "/events/styles/rick-and-morty.webp", name: "Sci-fi cartoon" },
];

const THEMES = [
  { file: "/events/styles/holiday.webp", name: "Holiday party", blurb: "Santa hats, ugly sweaters, snowflakes" },
  { file: "/events/styles/corporate.webp", name: "Company event", blurb: "Blazers, lanyards, your logo on every sheet" },
  { file: "/events/styles/wedding.webp", name: "Wedding", blurb: "Black tie, champagne, your names and date" },
  { file: "/events/styles/birthday.webp", name: "Birthday", blurb: "Party hats, cake and confetti" },
];

const OCCASIONS = ["Weddings", "Birthday parties", "Bar & Bat Mitzvahs", "Corporate parties & offsites", "Brand activations & pop-ups", "School & community events", "Holiday parties", "Conferences"];

const INCLUDED = [
  { icon: Printer, text: "The booth: touchscreen, camera and a pro print-and-cut sticker printer" },
  { icon: Users, text: "A friendly attendant who runs everything" },
  { icon: Sparkles, text: "All the sticker paper and ink" },
  { icon: Smartphone, text: "Digital copies guests can save to their phone" },
  { icon: QrCode, text: "Guests can also join from their own phone with a QR code" },
  { icon: Heart, text: "Custom styles and themes: your logo, names or date on every sheet" },
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
            A cartoon sticker photo booth for <span className="gradient-text">your event</span>
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

      {/* real people, real stickers */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <h2 className="font-display text-3xl font-bold md:text-4xl">Real people, real stickers</h2>
        <p className="mt-2 text-muted-foreground">Printed and cut on the spot, ready to peel. Works on pets too.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/events/guests-sheets.jpg" alt="Two guests holding their MeSticker sheets" loading="lazy" className="aspect-[3/4] w-full rounded-3xl object-cover shadow-md" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/events/dog-sheet.jpg" alt="A dachshund in a sweater with its owner holding a sticker sheet" loading="lazy" className="aspect-[3/4] w-full rounded-3xl object-cover shadow-md" />
          <div className="flex aspect-[3/4] flex-col items-center justify-center rounded-3xl bg-[#1a1a2e] p-6 text-center shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/events/dog-sticker.webp" alt="The dachshund as a chibi sticker" loading="lazy" className="w-full max-w-[320px]" />
            <p className="mt-3 font-display text-lg font-bold text-white">…and the pup&apos;s sticker 🐶</p>
          </div>
        </div>
      </section>

      {/* the three sheets */}
      <section className="bg-primary/5 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Three sheets to choose from</h2>
          <p className="mt-2 text-muted-foreground">Every sheet has 12 stickers on 4×7&quot; kiss-cut paper. Guests can take one, two or all three.</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {SHEETS.map((sh) => (
              <figure key={sh.file} className="flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sh.file} alt={`${sh.name} sticker sheet`} loading="lazy" className="w-full max-w-[300px] rounded-xl bg-white shadow-[0_14px_36px_rgba(91,63,214,0.22)]" style={{ aspectRatio: "3.9 / 6.7" }} />
                <figcaption className="mt-4 text-center">
                  <div className="font-display text-xl font-bold">
                    {sh.emoji} {sh.name}
                  </div>
                  <div className="text-muted-foreground">{sh.blurb}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* custom styles + themes */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-3xl font-bold md:text-4xl">
          Styled for <span className="gradient-text">your event</span>
        </h2>
        <p className="mt-2 max-w-[62ch] text-muted-foreground">
          Pick the cartoon style, and we&apos;ll theme every sticker to match the occasion: outfits, props, colors, plus your logo, names or date on
          every sheet. Want something one-of-a-kind? We can design a custom style just for your event.
        </p>

        <h3 className="mt-10 font-display text-xl font-bold">Cartoon styles</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {STYLES.map((st) => (
            <figure key={st.file} className="rounded-3xl bg-white p-4 text-center shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={st.file} alt={`${st.name} style sticker`} loading="lazy" className="mx-auto aspect-square w-full object-contain" />
              <figcaption className="mt-2 font-display font-bold">{st.name}</figcaption>
            </figure>
          ))}
        </div>

        <h3 className="mt-10 font-display text-xl font-bold">Event themes</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {THEMES.map((t) => (
            <figure key={t.file} className="rounded-3xl bg-primary/5 p-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.file} alt={`${t.name} themed sticker`} loading="lazy" className="mx-auto aspect-square w-full max-w-[240px] object-contain" />
              <figcaption className="mt-2">
                <div className="font-display text-lg font-bold">{t.name}</div>
                <div className="text-sm text-muted-foreground">{t.blurb}</div>
              </figcaption>
            </figure>
          ))}
        </div>
        <a href="#book" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-bold text-white">
          Tell us your theme <ArrowRight size={18} />
        </a>
      </section>

      {/* how it works */}
      <section className="py-14">
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
