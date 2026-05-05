import NicheLanding from "@/components/niche-landing";

export const metadata = {
  title: "Custom Stickers for Teachers · MeSticker",
  description:
    "End-of-year stickers your students will fight over. Turn any photo into a sheet of 6 custom cartoon stickers. Bulk-friendly.",
  openGraph: {
    title: "Custom Stickers for Teachers · MeSticker",
    description: "End-of-year teacher stickers students actually fight over.",
    images: ["/og-image.png"],
  },
};

export default function TeacherStickersPage() {
  return (
    <NicheLanding
      headline="End-of-year stickers your students will fight over."
      subhead="Turn your face — or your class roster — into a sheet of custom cartoon stickers. Perfect classroom rewards or year-end gifts."
      ctaText="Make my classroom stickers"
      bullets={[
        "One photo (yours or a student's) → cartoon sticker sheet in 30 seconds",
        "6 stickers per sheet, 5.83″ × 8.27″, kiss-cut for easy peel",
        "Order one or order in bulk — first sheet $14.99, each additional $9.99",
        "Great for: end-of-year goodie bags, classroom reward systems, parent-teacher gifts",
        "Free US shipping · 3–5 day delivery",
      ]}
      testimonial={{
        quote:
          "Made one of myself and gave a sheet to each of my 22 second-graders on the last day. They keep them in their planners. Cried.",
        author: "Verified MeSticker customer · 2nd grade teacher",
      }}
    />
  );
}
