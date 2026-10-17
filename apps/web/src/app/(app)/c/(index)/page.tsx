import { ChevronRight, Globe2, MessagesSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { GLOBAL_COMMUNITY } from '@everydaily/shared/domain';
import type { IconKey } from '@everydaily/shared/registry/icons';
import { GameIcon } from '@/components/game/game-icon';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { communityIndex } from '@/server/community';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Community' };

export default async function CommunityIndex() {
  const { user } = await requireSession();
  const { followed, active } = await communityIndex(user);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl sm:text-4xl">Community</h1>
        <p className="mt-1 text-ink-soft">
          Every game has its own board with a daily thread. Spoilers stay hidden until you&apos;ve
          played.
        </p>
      </div>
      <Link
        href={`/c/${GLOBAL_COMMUNITY}`}
        className="flex items-center justify-between gap-3 rounded-lg border-[length:var(--bw)] border-line bg-grape p-5 text-on-grape shadow-lift-md"
      >
        <span className="flex items-center gap-3">
          <Globe2 className="size-8 shrink-0" aria-hidden />
          <span>
            <span className="block font-display text-xl font-semibold">EveryDaily</span>
            <span className="text-sm">Tips, streaks, new finds: everything daily puzzles.</span>
          </span>
        </span>
        <ChevronRight className="size-6 shrink-0" aria-hidden />
      </Link>
      <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="your-boards">
        <h2 id="your-boards" className="text-xl">
          Your games
        </h2>
        {followed.length ? (
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="followed-communities">
            {followed.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/c/${g.slug}`}
                  className="flex items-center gap-3 rounded-md border-2 border-line-soft p-3 hover:bg-surface-2"
                >
                  <GameIcon icon={g.icon as IconKey} color={g.accentColor} size="sm" />
                  <span className="font-display font-semibold">{g.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Follow some games" className="py-6">
            Each game you follow gets a board here. Find them on the Games tab.
          </EmptyState>
        )}
      </Card>
      {active.length ? (
        <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="active-boards">
          <h2 id="active-boards" className="flex items-center gap-2 text-xl">
            <MessagesSquare className="size-5 text-ink-soft" aria-hidden />
            Busy this week
          </h2>
          <ul className="divide-y-2 divide-line-soft">
            {active.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/c/${c.slug}`}
                  className="flex justify-between gap-3 py-2.5 hover:underline"
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-sm text-ink-soft">{c.posts} new posts</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
