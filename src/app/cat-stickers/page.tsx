import NicheLanding from "@/components/niche-landing";

export const metadata = {
  title: "Custom Cat Stickers from your photo · MeSticker",
  description:
    "Turn a photo of your cat into a custom cartoon sticker sheet. 6 stickers per sheet, kiss-cut, ships free in the US.",
  openGraph: {
    title: "Custom Cat Stickers · MeSticker",
    description: "Your cat as a cartoon. Six stickers per sheet, ships free.",
    images: ["/og-image.png"],
  },
};

export default function CatStickersPage() {
  return (
    <NicheLanding
      headline="Your cat. Iconic. On a sticker."
      subhead="Snap a photo of your cat. Get six custom cartoon stickers of them. Made in 30 seconds, shipped free."
      ctaText="Make my cat's stickers"
      bullets={[
        "One photo of your cat → adorable chibi cartoon",
        "Sheet of 6 kiss-cut stickers, premium vinyl",
        "Stick them on your phone case, planner, water bottle, or gift them to your fellow cat-people friends",
        "Free US shipping · 3–5 days · $14.99",
      ]}
      testimonial={{
        quote:
          "My cat hates everyone except me but somehow approves of his sticker. 10/10 would recommend.",
        author: "Verified MeSticker customer",
      }}
    />
  );
}
