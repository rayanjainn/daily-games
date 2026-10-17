'use client';

import { Lightbulb, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { filterCatalog, type CatalogFilter } from '@everydaily/shared/catalog/filter';
import {
  CATEGORY_LABELS,
  DIFFICULTIES,
  EMBED_MODES,
  GAME_CATEGORIES,
  type Difficulty,
  type EmbedMode,
  type GameCategory,
  type Tier,
} from '@everydaily/shared/domain';
import { GameCard } from '@/components/game/game-card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Select } from '@/components/ui/input';
import { DIFFICULTY_LABELS, EMBED_LABELS, TRACKING } from '@/lib/catalog-labels';
import { useDebounced } from '@/lib/use-debounced';
import type { CatalogGame } from '@/server/catalog';

export interface InitialFilter {
  q: string;
  category: string | null;
  difficulty: string | null;
  tier: string | null;
  embed: string | null;
  following: boolean;
}

const pick = <T extends string>(list: readonly T[], v: string | null): T | null =>
  v && (list as readonly string[]).includes(v) ? (v as T) : null;

function fromInitial(i: InitialFilter): Required<CatalogFilter> {
  const tier = Number(i.tier);
  return {
    q: i.q.slice(0, 60),
    category: pick(GAME_CATEGORIES, i.category),
    difficulty: pick(DIFFICULTIES, i.difficulty),
    tier: tier === 1 || tier === 2 || tier === 3 ? (tier as Tier) : null,
    embed: pick(EMBED_MODES, i.embed),
    following: i.following,
  };
}

/** Keeps the filters in the address bar so a filtered catalog can be shared or reloaded. */
function syncUrl(f: Required<CatalogFilter>) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.category) p.set('category', f.category);
  if (f.difficulty) p.set('difficulty', f.difficulty);
  if (f.tier) p.set('tier', String(f.tier));
  if (f.embed) p.set('embed', f.embed);
  if (f.following) p.set('following', '1');
  const qs = p.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

export function CatalogView({
  games,
  followedIds,
  initial,
  canSuggest,
}: {
  games: CatalogGame[];
  followedIds: string[];
  initial: InitialFilter;
  canSuggest: boolean;
}) {
  const [f, setF] = useState(() => fromInitial(initial));
  const q = useDebounced(f.q, 120);
  const followedIdSet = useMemo(() => new Set(followedIds), [followedIds]);
  const followedSlugs = useMemo(
    () => new Set(games.filter((g) => followedIdSet.has(g.id)).map((g) => g.slug)),
    [games, followedIdSet],
  );
  const results = useMemo(
    () => filterCatalog(games, { ...f, q }, followedSlugs),
    [games, f, q, followedSlugs],
  );
  const counts = useMemo(() => {
    const c = new Map<GameCategory, number>();
    for (const g of games) c.set(g.category, (c.get(g.category) ?? 0) + 1);
    return c;
  }, [games]);

  useEffect(() => syncUrl({ ...f, q }), [f, q]);

  const set = (patch: Partial<CatalogFilter>) => setF((prev) => ({ ...prev, ...patch }));
  const filtered = Boolean(f.q || f.category || f.difficulty || f.tier || f.embed) || f.following;
  const clear = () =>
    setF({ q: '', category: null, difficulty: null, tier: null, embed: null, following: false });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl">Games</h1>
          <p className="mt-1 text-ink-soft">
            {games.length} daily puzzles. Follow the ones you play to build your checklist.
          </p>
        </div>
        {canSuggest ? (
          <Button asChild variant="secondary" size="sm">
            <Link href="/games/suggest">
              <Lightbulb aria-hidden />
              Suggest a game
            </Link>
          </Button>
        ) : null}
      </div>

      <div role="search" className="flex flex-col gap-3" aria-label="Find games">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <Input
            type="search"
            value={f.q}
            onChange={(e) => set({ q: e.target.value.slice(0, 60) })}
            placeholder="Search by name, publisher or tag"
            aria-label="Search games"
            className="pl-12 pr-12 [&::-webkit-search-cancel-button]:hidden"
            enterKeyHint="search"
          />
          {f.q ? (
            <button
              type="button"
              onClick={() => set({ q: '' })}
              className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-ink-soft hover:bg-surface-2 hover:text-ink"
              aria-label="Clear search"
            >
              <X className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>

        <div
          role="group"
          aria-label="Category"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 pt-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          <Chip selected={!f.category} onClick={() => set({ category: null })}>
            All
          </Chip>
          {GAME_CATEGORIES.filter((c) => counts.has(c)).map((c) => (
            <Chip
              key={c}
              selected={f.category === c}
              onClick={() => set({ category: f.category === c ? null : c })}
            >
              {CATEGORY_LABELS[c]}
              <span className="text-xs opacity-70">{counts.get(c)}</span>
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select
            aria-label="Difficulty"
            value={f.difficulty ?? ''}
            onChange={(e) => set({ difficulty: (e.target.value || null) as Difficulty | null })}
            className="h-10 text-sm sm:w-40"
          >
            <option value="">Any difficulty</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Tracking"
            value={f.tier ?? ''}
            onChange={(e) =>
              set({ tier: e.target.value ? (Number(e.target.value) as Tier) : null })
            }
            className="h-10 text-sm sm:w-40"
          >
            <option value="">Any tracking</option>
            {([1, 2, 3] as const).map((t) => (
              <option key={t} value={t}>
                {TRACKING[t].label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Where it plays"
            value={f.embed ?? ''}
            onChange={(e) => set({ embed: (e.target.value || null) as EmbedMode | null })}
            className="h-10 text-sm sm:w-48"
          >
            <option value="">Anywhere</option>
            {EMBED_MODES.map((m) => (
              <option key={m} value={m}>
                {EMBED_LABELS[m]}
              </option>
            ))}
          </Select>
          <Chip
            selected={f.following}
            onClick={() => set({ following: !f.following })}
            className="h-10 justify-center"
          >
            Following
            <span className="text-xs opacity-70">{followedIds.length}</span>
          </Chip>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-soft" aria-live="polite" role="status">
          {results.length === games.length
            ? `Showing all ${games.length} games`
            : `${results.length} of ${games.length} games`}
        </p>
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <h2 className="sr-only">Results</h2>
      {results.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Games">
          {results.map((g) => (
            <GameCard key={g.id} game={g} following={followedIdSet.has(g.id)} />
          ))}
        </ul>
      ) : (
        <EmptyState
          art="search"
          title={
            f.following && followedIds.length === 0 ? 'Nothing followed yet' : 'No games match'
          }
          action={
            <Button variant="secondary" onClick={clear}>
              Show all games
            </Button>
          }
        >
          {f.following && followedIds.length === 0
            ? 'Tap the plus on any game to add it to your daily checklist.'
            : 'Try a shorter search or fewer filters.'}
        </EmptyState>
      )}
    </div>
  );
}
