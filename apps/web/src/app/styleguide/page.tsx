import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StyleguideClient } from './styleguide-client';

export const metadata: Metadata = { title: 'Styleguide', robots: { index: false } };

/** Living reference for the design system. Hidden in production unless explicitly enabled. */
export default function StyleguidePage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_STYLEGUIDE !== '1') notFound();
  return <StyleguideClient />;
}
