import NicheLanding from "@/components/niche-landing";

export const metadata = {
  title: "Custom Birthday Stickers · MeSticker",
  description:
    "The cutest birthday gift you can hand them tomorrow. Turn any photo into a sheet of 6 custom cartoon stickers. Ships free in 3–5 days.",
  openGraph: {
    title: "Custom Birthday Stickers · MeSticker",
    description: "The cutest birthday gift in your camera roll.",
    images: ["/og-image.png"],
  },
};

export default function BirthdayStickersPage() {
  return (
    <NicheLanding
      headline="The cutest birthday gift in your camera roll."
      subhead="Their photo. Six custom cartoon stickers. In a card. On their desk. The reaction is priceless."
      ctaText="Make a birthday sticker pack"
      bullets={[
        "Snap or upload any photo — we turn it into a kawaii chibi cartoon",
        "Sheet of 6 stickers arrives in 3–5 days, free US shipping",
        "Perfect for: birthday cards, goodie bags, party favors, milestone gifts",
        "$14.99/sheet · $9.99 each additional · order multiple for the whole party",
      ]}
      testimonial={{
        quote:
          "Gave my best friend stickers of herself for her 30th. She has not stopped showing them to people. Best $15 I've spent.",
        author: "Verified MeSticker customer",
      }}
    />
  );
}
