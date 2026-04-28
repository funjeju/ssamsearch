/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ssamsearch/shared', '@ssamsearch/crypto'],
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://apis.google.com",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "img-src 'self' data: https:",
            "font-src 'self' data: https://cdn.jsdelivr.net",
            "connect-src 'self' https://*.googleapis.com https://*.upstash.io https://firebaseapp.com",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    },
  ],
};

module.exports = nextConfig;
