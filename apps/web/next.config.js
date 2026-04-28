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
        // same-origin-allow-popups: Google OAuth 팝업과의 통신 허용
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com",
            "img-src 'self' data: https:",
            "font-src 'self' data: https://cdn.jsdelivr.net",
            "connect-src 'self' https://*.googleapis.com https://*.upstash.io https://*.firebaseapp.com https://*.firebaseio.com",
            "frame-src https://accounts.google.com https://aianal.firebaseapp.com",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    },
  ],
};

module.exports = nextConfig;
