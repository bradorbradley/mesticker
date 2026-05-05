import NicheLanding from "@/components/niche-landing";

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

export default function DogStickersPage() {
  return (
    <NicheLanding
      headline="Your dog deserves to be on every water bottle."
      subhead="Snap a photo. Get a sheet of 6 custom cartoon stickers of your dog. Made in 30 seconds, shipped free."
      ctaText="Make my dog's stickers"
      bullets={[
        "Upload one photo — we turn it into a chibi-style cartoon dog",
        "Sheet of 6 kiss-cut stickers, 5.83″ × 8.27″",
        "Perfect for water bottles, laptops, journals, gifts for fellow dog parents",
        "Free US shipping · arrives in 3–5 days · $14.99",
      ]}
      testimonial={{
        quote:
          "I made one of my golden retriever and now I'm making one for every dog I know. They're addictive.",
        author: "Verified MeSticker customer",
      }}
    />
  );
}
