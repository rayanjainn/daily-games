import type { MetadataRoute } from 'next';
import { BRAND } from '@everydaily/shared';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    start_url: '/today?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BRAND.backgroundColor,
    theme_color: BRAND.backgroundColor,
    categories: ['games', 'entertainment', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      // One-colour shape for Android themed icons.
      {
        src: '/icons/monochrome-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'monochrome',
      },
    ],
    shortcuts: [
      { name: 'Today', url: '/today?source=shortcut' },
      { name: 'Games', url: '/games?source=shortcut' },
    ],
  };
}
