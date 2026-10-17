'use client';

import { ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { foldText } from '@everydaily/shared/catalog/filter';
import type { IconKey } from '@everydaily/shared/registry/icons';
import { GameIcon } from '@/components/game/game-icon';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface Row {
  slug: string;
  name: string;
  publisher: string;
  tier: 1 | 2 | 3;
  status: 'active' | 'possibly_down' | 'archived';
  icon: string;
  accentColor: string;
  edited: boolean;
}

export function AdminGameList({ games }: { games: Row[] }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const f = foldText(q);
    return f
      ? games.filter((g) => foldText(`${g.name} ${g.publisher} ${g.slug}`).includes(f))
      : games;
  }, [games, q]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl sm:text-3xl">Games</h1>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Filter games"
          placeholder="Filter by name, publisher or slug"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-12"
        />
      </div>
      <ul className="divide-y-2 divide-line-soft overflow-hidden rounded-lg border-[length:var(--bw)] border-line bg-surface shadow-lift-sm">
        {shown.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/admin/games/${g.slug}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
            >
              <GameIcon icon={g.icon as IconKey} color={g.accentColor} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display font-semibold">{g.name}</span>
                <span className="block truncate text-xs text-ink-soft">{g.publisher}</span>
              </span>
              <span className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                {g.edited ? <Badge tone="info">Edited</Badge> : null}
                {g.status !== 'active' ? (
                  <Badge tone={g.status === 'archived' ? 'danger' : 'warn'}>
                    {g.status === 'archived' ? 'Archived' : 'May be down'}
                  </Badge>
                ) : null}
              </span>
              <Badge tone={g.tier === 1 ? 'grape' : g.tier === 2 ? 'sky' : 'neutral'}>
                Tier {g.tier}
              </Badge>
              <ChevronRight className="size-4 text-ink-faint" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="text-sm text-ink-soft">No games match.</p> : null}
    </div>
  );
}
