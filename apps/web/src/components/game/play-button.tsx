'use client';

import { ExternalLink, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export interface PlayableGame {
  slug: string;
  name: string;
  url: string;
  embedMode: 'iframe' | 'popout' | 'native';
}

const site = (url: string) => new URL(url).hostname.replace(/^www\./, '');

/**
 * Opens a game the way its embed mode allows. Popout games open only from this click (so popup
 * blockers allow it): a side window on wide screens, a new tab on phones. When the browser
 * blocks the window anyway, a plain link appears instead. `onReturn` fires when the player comes
 * back to this tab after playing, which is when to ask for the result.
 */
export function PlayButton({
  game,
  onOpened,
  onReturn,
  label,
  className,
  wrapperClassName,
  size,
  variant,
}: {
  game: PlayableGame;
  onOpened?: () => void;
  onReturn?: () => void;
  label?: ReactNode;
  className?: string;
  wrapperClassName?: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
}) {
  const [blocked, setBlocked] = useState(false);
  const away = useRef(false);

  useEffect(() => {
    if (!onReturn) return;
    const back = () => {
      if (document.visibilityState === 'visible' && away.current) {
        away.current = false;
        onReturn();
      }
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    return () => {
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('focus', back);
    };
  }, [onReturn]);

  if (game.embedMode !== 'popout') {
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <Link href={`/games/${game.slug}/play`}>
          <Play aria-hidden />
          {label ?? 'Play'}
        </Link>
      </Button>
    );
  }

  function open() {
    const wide = window.matchMedia('(min-width: 768px)').matches;
    const w = wide
      ? window.open(
          game.url,
          'ed-play',
          `popup,width=480,height=860,left=${Math.max(0, window.screenX + window.outerWidth - 500)},top=${window.screenY + 40}`,
        )
      : window.open(game.url, '_blank');
    if (!w) {
      setBlocked(true);
      return;
    }
    // The game must not be able to navigate this tab (reverse tabnabbing).
    try {
      w.opener = null;
    } catch {
      // Cross-origin by now; nothing to clear.
    }
    setBlocked(false);
    away.current = true;
    onOpened?.();
  }

  return (
    <span className={cn('inline-flex flex-col items-start gap-2', wrapperClassName)}>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={open}
        data-testid="play-button"
      >
        {label ?? 'Play'}
        <ExternalLink aria-hidden />
        <span className="sr-only"> {game.name} (opens a new window)</span>
      </Button>
      {blocked ? (
        <span role="alert" className="text-sm text-ink-soft" data-testid="popup-blocked">
          Your browser blocked the game window.{' '}
          <a
            href={game.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              away.current = true;
              onOpened?.();
            }}
            className="font-semibold text-ink underline underline-offset-4"
          >
            Open {site(game.url)}
          </a>
        </span>
      ) : null}
    </span>
  );
}
