import type { NextConfig } from 'next';

const config: NextConfig = {
  // packages/shared ships TypeScript source.
  transpilePackages: ['@everydaily/shared'],
  poweredByHeader: false,
};

export default config;
