import { ArrowLeft, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LogPanel } from '@/components/game/log-panel';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getGameBySlug } from '@/server/catalog';
import { requireSession } from '@/server/session';
import { CipherGame } from '@/components/native/cipher-game';
import { MakeItGame } from '@/components/native/make-it-game';
import { ScrambleGame } from '@/components/native/scramble-game';
import { nativeView } from '@/server/native';
import { IframeHost } from './iframe-host';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const game = await getGameBySlug((await params).slug);
  return { title: game ? `Play ${game.name}` : 'Game not found' };
}

/**
 * Plays a game inside EveryDaily: in a sandboxed frame for games whose embed probe passed, or
 * our own native games. Everything else opens on its own site from the game page.
 */
export default async function PlayPage({ params }: { params: Params }) {
  const { user } = await requireSession();
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game || game.status === 'archived') notFound();
  // Never frame a game without a passing probe, whatever the stored mode says.
  if (game.embedMode === 'popout' || (game.embedMode === 'iframe' && !game.verifiedEmbeddableAt))
    redirect(`/games/${slug}`);

  // Our own games: the puzzle, played right here. Opening it starts the clock.
  if (game.embedMode === 'native') {
    const view = await nativeView(user, game);
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Link
          href={`/games/${slug}`}
          className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {game.name}
        </Link>
        <div>
          <h1 className="text-3xl sm:text-4xl">{game.name}</h1>
          <p className="text-ink-soft" data-testid="native-puzzle">
            Puzzle #{view.puzzleNumber.toLocaleString('en-US')}
          </p>
        </div>
        <Card className="p-5 sm:p-6">
          {view.kind === 'cipher' ? (
            <CipherGame initial={view} />
          ) : view.kind === 'scramble' ? (
            <ScrambleGame initial={view} />
          ) : (
            <MakeItGame initial={view} />
          )}
        </Card>
      </div>
    );
  }

  const loggable = {
    slug: game.slug,
    name: game.name,
    tier: game.tier,
    scoringType: game.scoringType,
    maxAttempts: game.maxAttempts,
    scoringUnit: game.scoringUnit,
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/games/${slug}`}
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {game.name}
      </Link>
      <h1 className="sr-only">Play {game.name}</h1>
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        {game.embedMode === 'iframe' ? (
          <IframeHost name={game.name} url={game.url} slug={game.slug} />
        ) : (
          <Card className="p-6">
            <EmptyState title="EveryDaily originals are on the way" level={2}>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-4" aria-hidden /> Our own daily games will play right
                here.
              </span>
            </EmptyState>
          </Card>
        )}
        <Card asSection className="h-fit p-5" aria-labelledby="play-log-heading">
          <h2 id="play-log-heading" className="mb-3 text-xl">
            Log my result
          </h2>
          <LogPanel game={loggable} />
        </Card>
      </div>
    </div>
  );
}
