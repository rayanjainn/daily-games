import { ArrowLeft, CalendarDays, ExternalLink, Info, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CATEGORY_LABELS } from '@everydaily/shared/domain';
import { clockFromGame } from '@everydaily/shared/registry';
import { FollowButton } from '@/components/game/follow-button';
import { GameIcon } from '@/components/game/game-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { DIFFICULTY_LABELS, EMBED_LABELS, TRACKING, siteOf } from '@/lib/catalog-labels';
import { describeReset } from '@/lib/reset-copy';
import { attributionLine, getGameBySlug, isFollowing, toCatalogGame } from '@/server/catalog';
import { requireSession } from '@/server/session';
import { ReportDialog } from './report-dialog';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const game = await getGameBySlug((await params).slug);
  return { title: game && game.status !== 'archived' ? game.name : 'Game not found' };
}

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

export default async function GamePage({ params }: { params: Params }) {
  const { slug } = await params;
  const { user } = await requireSession();
  const row = await getGameBySlug(slug);
  if (!row || row.status === 'archived') notFound();
  const game = toCatalogGame(row, user.timezone);
  const following = await isFollowing(user.id, row.id);
  const reset = describeReset(clockFromGame(row).reset, user.timezone);
  const site = siteOf(game.url);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/games"
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All games
      </Link>

      {game.status === 'possibly_down' ? (
        <div className="flex gap-2 rounded-lg border-2 border-warn/30 bg-warn-soft p-3.5 text-sm text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Our daily check could not reach {site} recently. It may be down or may have moved.
          </span>
        </div>
      ) : null}

      <Card className="relative overflow-hidden p-5 sm:p-7">
        <div
          className="absolute inset-x-0 top-0 h-2.5 border-b-[length:var(--bw)] border-line"
          style={{ backgroundColor: game.accentColor }}
          aria-hidden
        />
        <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-start">
          <GameIcon icon={game.icon} color={game.accentColor} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-4xl">{game.name}</h1>
            <p className="mt-0.5 font-display font-semibold text-ink-soft">{game.publisher}</p>
            <p className="mt-3 max-w-prose text-md">{game.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Badge tone={game.tier === 1 ? 'grape' : game.tier === 2 ? 'sky' : 'neutral'}>
                {TRACKING[game.tier].label}
              </Badge>
              <Badge>{CATEGORY_LABELS[game.category]}</Badge>
              <Badge>{DIFFICULTY_LABELS[game.difficulty]}</Badge>
              <Badge>{EMBED_LABELS[game.embedMode]}</Badge>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <a href={game.url} target="_blank" rel="noopener noreferrer">
              Play on {site}
              <ExternalLink aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
          <FollowButton
            gameId={game.id}
            gameName={game.name}
            following={following}
            className="h-14 rounded-lg px-7 text-lg"
          />
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="today-heading">
          <h2 id="today-heading" className="flex items-center gap-2 text-xl">
            <CalendarDays className="size-5 text-ink-soft" aria-hidden />
            Today
          </h2>
          <p className="font-display text-3xl font-bold leading-none" data-testid="today-puzzle">
            {game.today.number !== null
              ? `#${game.today.number.toLocaleString('en-US')}`
              : longDate(game.today.date)}
          </p>
          {game.today.number !== null ? (
            <p className="text-sm text-ink-soft">{longDate(game.today.date)}</p>
          ) : null}
          <p className="mt-auto text-sm">
            {reset.headline}.{reset.detail ? ` ${reset.detail}` : ''}
          </p>
        </Card>
        <Card asSection className="md:col-span-2" aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">
            Your stats
          </h2>
          <EmptyState title="No results yet" className="h-full py-8">
            {TRACKING[game.tier].hint} Your streak and history will show up here.
          </EmptyState>
        </Card>
      </div>

      <section aria-labelledby="about-heading">
        <Card tone="muted" lift="sm" className="flex flex-col gap-3 p-5">
          <h2 id="about-heading" className="flex items-center gap-2 text-lg">
            <Info className="size-5 text-ink-soft" aria-hidden />
            About this game
          </h2>
          <p className="text-sm" data-testid="attribution">
            {attributionLine(game.publisher)}
          </p>
          {row.resetNote ? <p className="text-sm text-ink-soft">{row.resetNote}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <a
              href={game.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold underline decoration-2 underline-offset-4"
            >
              {site}
            </a>
            <ReportDialog slug={game.slug} gameName={game.name} />
          </div>
        </Card>
      </section>
    </div>
  );
}
