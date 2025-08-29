/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
      domains: ['localhost'],
    },
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: "frame-ancestors 'self' https://warpcast.com https://*.warpcast.com https://wallet.farcaster.xyz https://farcaster.xyz https://*.farcaster.xyz; connect-src 'self' data: blob: https://wallet.farcaster.xyz https://client.warpcast.com https://*.farcaster.xyz https://explorer-api.walletconnect.com https://*.privy.systems https://auth.privy.io https://*.wrpcd.net https://cloudflareinsights.com https://*.cloudflareinsights.com; img-src 'self' data: blob: https:; media-src 'self' data: blob:; font-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff'
            },
            {
              key: 'Referrer-Policy',
              value: 'strict-origin-when-cross-origin'
            },
            {
              key: 'X-DNS-Prefetch-Control',
              value: 'on'
            }
          ],
        },
      ]
    },
  }
  
module.exports = nextConfig