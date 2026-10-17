import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShareImage } from '@/components/share/share-image';
import { Card } from '@/components/ui/card';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Your week' };

export default async function RecapPage() {
  const { user } = await requireSession();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link
        href="/today"
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Today
      </Link>
      <div>
        <h1 className="text-3xl sm:text-4xl">Your week</h1>
        <p className="mt-1 text-ink-soft">
          The last seven days as a game board: green solved, red missed the answer, pale not played.
          No answers on it, so it&apos;s safe to share.
        </p>
      </div>
      <Card className="p-4">
        <ShareImage
          src="/api/cards/week"
          filename={`everydaily-week-${user.username}.png`}
          alt={`${user.displayName ?? user.username}'s puzzle week`}
          width={1080}
          height={1350}
        />
      </Card>
    </div>
  );
}
