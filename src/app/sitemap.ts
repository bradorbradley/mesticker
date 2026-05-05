import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://mesticker.fun";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1.0 },
    // Niche landing pages — primary SEO targets
    { url: `${base}/dog-stickers`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/cat-stickers`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/kid-stickers`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/teacher-stickers`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/birthday-stickers`, changeFrequency: "weekly", priority: 0.9 },
    // Legal
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refunds`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.4 },
  ];
}
