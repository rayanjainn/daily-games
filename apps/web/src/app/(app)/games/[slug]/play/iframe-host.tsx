'use client';

import { Loader2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PlayButton } from '@/components/game/play-button';

const WATCHDOG_MS = 8_000;

/**
 * Sandboxed frame for games that passed the embed probe. We can't read a cross-origin frame,
 * so a refusal is inferred from the load event not arriving in time; then the game opens in
 * its own window instead.
 */
export function IframeHost({ name, url, slug }: { name: string; url: string; slug: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'blocked'>('loading');

  useEffect(() => {
    const t = setTimeout(() => setState((s) => (s === 'loading' ? 'blocked' : s)), WATCHDOG_MS);
    return () => clearTimeout(t);
  }, []);

  if (state === 'blocked') {
    return (
      <div
        className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-lg border-[length:var(--bw)] border-line bg-surface p-6 text-center"
        data-testid="frame-blocked"
      >
        <TriangleAlert className="size-10 text-warn" aria-hidden />
        <p className="max-w-md">
          This game doesn&apos;t allow being shown inside other sites. Opening it in its own window.
        </p>
        <PlayButton game={{ slug, name, url, embedMode: 'popout' }} label={`Open ${name}`} />
      </div>
    );
  }

  return (
    <div className="relative min-h-[70dvh] overflow-hidden rounded-lg border-[length:var(--bw)] border-line bg-surface">
      {state === 'loading' ? (
        <div
          className="absolute inset-0 grid place-items-center text-ink-soft"
          role="status"
          data-testid="frame-loading"
        >
          <span className="inline-flex items-center gap-2 font-display font-semibold">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Loading {name}…
          </span>
        </div>
      ) : null}
      <iframe
        src={url}
        title={name}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        referrerPolicy="no-referrer"
        allow=""
        loading="eager"
        onLoad={() => setState('ready')}
        className="absolute inset-0 size-full"
        data-testid="game-frame"
      />
    </div>
  );
}
