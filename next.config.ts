import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
