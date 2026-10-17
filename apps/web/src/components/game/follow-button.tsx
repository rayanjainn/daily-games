'use client';

import { Check, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

/**
 * Follow toggle with an optimistic update; the server state wins on error.
 * `compact` is the round icon button used on catalog cards.
 */
export function FollowButton({
  gameId,
  gameName,
  following: initial,
  compact = false,
  className,
}: {
  gameId: string;
  gameName: string;
  following: boolean;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      await api(`/api/follows/${gameId}`, {}, next ? 'POST' : 'DELETE');
      router.refresh();
    } catch (err) {
      setFollowing(!next);
      toast({
        tone: 'error',
        title: err instanceof ApiError ? err.message : 'Could not update. Try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  const label = following ? `Following ${gameName}` : `Follow ${gameName}`;
  if (compact) {
    return (
      <Button
        type="button"
        size="icon"
        variant={following ? 'mint' : 'secondary'}
        aria-pressed={following}
        aria-label={label}
        title={following ? 'Following' : 'Follow'}
        onClick={toggle}
        disabled={busy}
        aria-busy={busy || undefined}
        className={cn('size-10', className)}
      >
        {following ? <Check aria-hidden /> : <Plus aria-hidden />}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant={following ? 'mint' : 'secondary'}
      aria-pressed={following}
      onClick={toggle}
      disabled={busy}
      aria-busy={busy || undefined}
      className={className}
    >
      {following ? <Check aria-hidden /> : <Plus aria-hidden />}
      {following ? 'Following' : 'Follow'}
      <span className="sr-only"> {gameName}</span>
    </Button>
  );
}
