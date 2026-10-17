import type { NextConfig } from 'next';

const config: NextConfig = {
  // packages/shared ships TypeScript source.
  transpilePackages: ['@everydaily/shared'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Browsers must always check for a new service worker.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default config;
