import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets two dev servers run side by side (NEXT_DIST_DIR=.next-b)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // short link for the party QR code
  async redirects() {
    return [{ source: "/christmascarol", destination: "/booth/christmascarol", permanent: false }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
