import { ArrowLeft, MessageCircle, Pin } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentMenu } from '@/components/community/content-menu';
import { FlairBadge } from '@/components/community/flair-badge';
import { PostComposer } from '@/components/community/post-composer';
import { VoteButtons } from '@/components/community/vote-buttons';
import { FlairManager } from '@/components/community/flair-manager';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import {
  ensureCommunity,
  ensureDailyThread,
  feed,
  isModerator,
  listFlairs,
} from '@/server/community';
import { requireSession } from '@/server/session';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; flair?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await ensureCommunity((await params).slug);
  return { title: c ? `${c.community.name} community` : 'Community' };
}

export default async function CommunityPage({ params, searchParams }: Props) {
  const [{ slug }, sp, { user }] = await Promise.all([params, searchParams, requireSession()]);
  const c = await ensureCommunity(slug);
  if (!c) notFound();
  const sort = sp.sort === 'new' ? 'new' : 'hot';
  const flairList = await listFlairs(c.community.id);
  const flairId = flairList.find((f) => f.id === sp.flair)?.id ?? null;
  const [daily, posts] = await Promise.all([
    c.game ? ensureDailyThread(c.community, c.game, user.timezone) : null,
    feed(user, c.community.id, { sort, flairId }),
  ]);
  const mod = isModerator(user);
  const href = (q: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = { sort, flair: flairId, ...q };
    if (next.sort === 'new') p.set('sort', 'new');
    if (next.flair) p.set('flair', next.flair);
    const s = p.toString();
    return `/c/${slug}${s ? `?${s}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/c"
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Community
      </Link>
      <Card className="flex flex-col gap-3 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl">{c.community.name}</h1>
            <p className="mt-1 text-ink-soft">{c.community.description}</p>
            {c.game ? (
              <Link
                href={`/games/${c.game.slug}`}
                className="mt-1 inline-block text-sm font-semibold underline underline-offset-4"
              >
                Game page and stats
              </Link>
            ) : null}
          </div>
          <PostComposer
            slug={slug}
            communityName={c.community.name}
            flairs={flairList.map((f) => ({ id: f.id, name: f.name }))}
          />
        </div>
        {mod ? <FlairManager slug={slug} flairs={flairList} /> : null}
      </Card>

      {daily ? (
        <Link
          href={`/c/${slug}/${daily.id}`}
          className="flex items-center justify-between gap-3 rounded-lg border-[length:var(--bw)] border-line bg-sun p-4 text-on-sun shadow-lift-sm"
          data-testid="daily-thread"
        >
          <span className="flex items-center gap-2">
            <Pin className="size-5 shrink-0" aria-hidden />
            <span className="font-display text-lg font-semibold">{daily.title}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold">
            <MessageCircle className="size-4" aria-hidden /> {daily.commentCount}
          </span>
        </Link>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Sort posts" className="flex gap-1">
          {(['hot', 'new'] as const).map((s) => (
            <Link
              key={s}
              href={href({ sort: s })}
              aria-current={sort === s ? 'page' : undefined}
              className={cn(
                'rounded-pill border-[length:var(--bw)] border-line px-3 py-1 font-display text-sm font-semibold',
                sort === s ? 'bg-ink text-paper' : 'bg-surface hover:bg-surface-2',
              )}
            >
              {s === 'hot' ? 'Hot' : 'New'}
            </Link>
          ))}
        </nav>
        {flairList.length ? (
          <nav aria-label="Filter by flair" className="flex flex-wrap gap-1">
            {flairList.map((f) => (
              <Link
                key={f.id}
                href={href({ flair: flairId === f.id ? null : f.id })}
                aria-current={flairId === f.id ? 'page' : undefined}
                className={cn('rounded-pill', flairId === f.id && 'ring-4 ring-focus/40')}
              >
                <FlairBadge flair={f} />
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {posts.length ? (
        <ul className="flex flex-col gap-3" data-testid="posts">
          {posts.map((p) => (
            <li key={p.id}>
              <Card className={cn('flex gap-3 p-4', p.status === 'removed' && 'opacity-60')}>
                <VoteButtons
                  type="post"
                  id={p.id}
                  score={p.score}
                  myVote={p.myVote}
                  disabled={p.status === 'removed'}
                  label={p.title}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.flair ? <FlairBadge flair={p.flair} /> : null}
                    {p.spoiler ? <Badge tone="warn">Spoiler</Badge> : null}
                    {p.status === 'locked' ? <Badge>Locked</Badge> : null}
                    {p.status === 'removed' ? <Badge tone="danger">Removed</Badge> : null}
                  </div>
                  <Link
                    href={`/c/${slug}/${p.id}`}
                    className="mt-1 block font-display text-lg font-semibold leading-snug hover:underline"
                  >
                    {p.title}
                  </Link>
                  {p.excerpt ? (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{p.excerpt}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                    <span>by {p.author ?? 'deleted player'}</span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="size-3.5" aria-hidden /> {p.commentCount}
                    </span>
                    {mod ? (
                      <ContentMenu type="post" id={p.id} mine={false} mod status={p.status} />
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState title="No posts yet" className="py-8">
            Start the first conversation in {c.community.name}.
          </EmptyState>
        </Card>
      )}
    </div>
  );
}
