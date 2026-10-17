import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DIFFICULTY_LABELS, TRACKING } from '@/lib/catalog-labels';
import type { CatalogGame } from '@/server/catalog';
import { CategoryBadge } from './category-badge';
import { FollowButton } from './follow-button';
import { GameIcon } from './game-icon';

/**
 * Catalog tile. The whole card links to the game page (a stretched link), while the follow
 * button sits above it so it stays separately clickable and focusable.
 */
export function GameCard({ game, following }: { game: CatalogGame; following: boolean }) {
  return (
    <li
      className="group relative flex flex-col gap-3 rounded-lg border-[length:var(--bw)] border-line bg-surface p-4 shadow-lift-md transition-[transform,box-shadow] duration-[var(--dur-fast)] focus-within:ring-4 focus-within:ring-focus/40 hover:-translate-y-0.5 hover:shadow-lift-lg"
      data-testid="game-card"
    >
      <div className="flex items-start gap-3">
        <GameIcon icon={game.icon} color={game.accentColor} size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-semibold leading-tight">
            <Link
              href={`/games/${game.slug}`}
              className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
            >
              {game.name}
            </Link>
          </h3>
          <p className="truncate text-sm text-ink-soft">{game.publisher}</p>
        </div>
        <FollowButton
          gameId={game.id}
          gameName={game.name}
          following={following}
          compact
          className="relative z-10"
        />
      </div>
      <p className="line-clamp-2 text-sm text-ink-soft">{game.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Badge tone={game.tier === 1 ? 'grape' : game.tier === 2 ? 'sky' : 'neutral'}>
          {TRACKING[game.tier].label}
        </Badge>
        <CategoryBadge category={game.category} />
        <Badge>{DIFFICULTY_LABELS[game.difficulty]}</Badge>
        {game.status === 'possibly_down' ? <Badge tone="warn">May be down</Badge> : null}
      </div>
    </li>
  );
}
