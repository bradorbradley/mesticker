import NicheLanding from "@/components/niche-landing";

export const metadata = {
  title: "Custom Pet Stickers from your photo · MeSticker",
  description:
    "Turn a photo of your pet into a custom cartoon sticker sheet. Dogs, cats, bunnies, birds, lizards — any pet. 6 stickers per sheet, kiss-cut, ships free in the US. Made in 30 seconds.",
  openGraph: {
    title: "Custom Pet Stickers · MeSticker",
    description:
      "Celebrate your pet with a sheet of 6 custom cartoon stickers. Any pet, any photo, ships free.",
    images: ["/og-image.png"],
  },
};

export default function PetsPage() {
  return (
    <NicheLanding
      headline="Celebrate your pet on every water bottle, laptop, and lunchbox."
      subhead="Snap a photo of your dog, cat, bunny — any pet. Get a sheet of 6 custom cartoon stickers of them. Made in 30 seconds, shipped free."
      ctaText="Make my pet's stickers"
      bullets={[
        "Works with any pet — dogs, cats, rabbits, birds, lizards, horses, you name it",
        "One photo → an adorable chibi cartoon version of your pet",
        "Sheet of 6 kiss-cut stickers, 5.83″ × 8.27″ premium vinyl",
        "Perfect on water bottles, laptops, journals, phone cases, and as gifts for fellow pet parents",
        "Free US shipping · arrives in 3–5 days · $14.99",
      ]}
      testimonial={{
        quote:
          "Made one of my golden retriever, then one of my cat, then one of my mom's parrot. I cannot stop. Everyone I know is getting their pet on a sticker.",
        author: "Verified MeSticker customer",
      }}
    />
  );
}
