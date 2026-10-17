import { WifiOff } from 'lucide-react';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Offline' };

/**
 * Shown by the service worker when a page can't load. It works without JavaScript, so links
 * are plain anchors that retry a real page load.
 */
export default function OfflinePage() {
  return (
    <AuthShell>
      <Card className="mt-6 flex flex-col items-center gap-4 p-8 text-center">
        <span className="grid size-16 place-items-center rounded-full border-[length:var(--bw)] border-line bg-sky text-on-sky shadow-lift-sm">
          <WifiOff className="size-8" aria-hidden />
        </span>
        <h1 className="text-3xl">You&apos;re offline</h1>
        <p className="text-ink-soft">
          EveryDaily needs a connection to load your checklist and save results. The puzzles will
          still be there when you&apos;re back.
        </p>
        {/* Plain links on purpose: a full page load is the retry. */}
        <a href="/today" className={buttonVariants({ size: 'lg' })}>
          Try again
        </a>
        <a href="/games" className="text-sm font-semibold underline underline-offset-4">
          Open the games list
        </a>
      </Card>
    </AuthShell>
  );
}
