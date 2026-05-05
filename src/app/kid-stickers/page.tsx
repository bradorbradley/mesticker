import NicheLanding from "@/components/niche-landing";

export const metadata = {
  title: "Custom Kid Stickers from your photo · MeSticker",
  description:
    "Turn a photo of your kid into a custom cartoon sticker sheet. Perfect for birthday goodie bags, gifts for grandparents, or just because.",
  openGraph: {
    title: "Custom Kid Stickers · MeSticker",
    description: "Your kid as a cartoon — perfect for birthday bags and grandparent gifts.",
    images: ["/og-image.png"],
  },
};

export default function KidStickersPage() {
  return (
    <NicheLanding
      headline="Turn your kid's silliest face into stickers."
      subhead="One photo of your kid becomes six custom cartoon stickers. Birthdays, goodie bags, grandparent fridges — covered."
      ctaText="Make my kid's stickers"
      bullets={[
        "Snap any photo — we'll turn it into a chibi-style cartoon",
        "Sheet of 6 kiss-cut stickers — peel-and-stick, kid-safe vinyl",
        "Perfect for birthday goodie bags, lunchboxes, water bottles, gifts to family",
        "Free US shipping · 3–5 days · $14.99 first sheet, $9.99 each after",
      ]}
      testimonial={{
        quote:
          "Made one for my son's 6th birthday goodie bags. The other parents wouldn't stop asking where I got them.",
        author: "Verified MeSticker customer",
      }}
    />
  );
}
