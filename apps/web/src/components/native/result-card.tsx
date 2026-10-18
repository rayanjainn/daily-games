'use client';

import { Check, Copy, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';

/** Shown when a native game is over: the result, a text to share, and the board. */
export function ResultCard({
  slug,
  heading,
  summary,
  shareText,
}: {
  slug: string;
  heading: string;
  summary: string;
  shareText: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg border-[length:var(--bw)] border-line bg-success-soft p-5 text-center"
      data-testid="native-result"
    >
      <Trophy className="size-9 text-success" aria-hidden />
      <h2 className="text-2xl">{heading}</h2>
      <p className="font-display text-3xl font-bold" data-testid="native-summary">
        {summary}
      </p>
      <pre
        className="whitespace-pre-wrap rounded-md bg-surface p-3 font-body text-sm"
        data-testid="native-share"
      >
        {shareText}
      </pre>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                `${shareText}\n\nhttps://everydaily.raycode.tech`,
              );
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard blocked: the text above can still be selected by hand.
            }
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? 'Copied' : 'Copy result'}
        </Button>
        <Link href={`/games/${slug}`} className={buttonVariants({ variant: 'ghost' })}>
          See today&apos;s best
        </Link>
      </div>
    </div>
  );
}
