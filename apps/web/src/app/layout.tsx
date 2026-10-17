import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { BRAND } from '@everydaily/shared';

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
