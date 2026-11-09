'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import {
  Bell,
  CalendarCheck,
  Gamepad2,
  MessagesSquare,
  Search,
  Settings,
  Trophy,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

interface GameItem {
  slug: string;
  name: string;
  publisher: string;
  category: string;
}

const PAGES = [
  { href: '/today', label: 'Today', icon: CalendarCheck },
  { href: '/games', label: 'All games', icon: Gamepad2 },
  { href: '/rankings', label: 'Rankings', icon: Trophy },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/c', label: 'Community', icon: MessagesSquare },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-ink aria-selected:bg-surface-2 data-[selected=true]:bg-surface-2';

/** ⌘K / Ctrl+K: jump to any game or page. The game list loads the first time it opens. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [games, setGames] = useState<GameItem[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open || games) return;
    fetch('/api/games', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { games: [] }))
      .then((d: { games: GameItem[] }) => setGames(d.games))
      .catch(() => setGames([]));
  }, [open, games]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="hidden h-10 items-center gap-2 rounded-full border-[length:var(--bw)] border-line-soft px-3 text-sm text-ink-soft hover:bg-surface-2 hover:text-ink md:flex"
        >
          <Search className="size-4" aria-hidden />
          <span>Search</span>
          <kbd aria-hidden className="rounded border border-line-soft px-1.5 font-body text-xs">
            ⌘K
          </kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border-[length:var(--bw)] border-line bg-surface shadow-overlay"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <Command label="Search games and pages" loop>
            <div className="flex items-center gap-2 border-b-2 border-line-soft px-4">
              <Search className="size-5 text-ink-faint" aria-hidden />
              <Command.Input
                autoFocus
                placeholder="Find a game or a page…"
                className="h-14 w-full bg-transparent text-md text-ink outline-none placeholder:text-ink-faint"
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="p-6 text-center text-sm text-ink-soft">
                {games === null ? 'Loading…' : 'Nothing matches.'}
              </Command.Empty>
              <Command.Group
                heading="Pages"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-ink-soft"
              >
                {PAGES.map((p) => (
                  <Command.Item
                    key={p.href}
                    value={p.label}
                    onSelect={() => go(p.href)}
                    className={itemClass}
                  >
                    <p.icon className="size-4 text-ink-soft" aria-hidden />
                    {p.label}
                  </Command.Item>
                ))}
              </Command.Group>
              {games?.length ? (
                <Command.Group
                  heading="Games"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-ink-soft"
                >
                  {games.map((g) => (
                    <Command.Item
                      key={g.slug}
                      value={`${g.name} ${g.publisher} ${g.category}`}
                      onSelect={() => go(`/games/${g.slug}`)}
                      className={cn(itemClass, 'justify-between')}
                    >
                      <span className="font-display font-semibold">{g.name}</span>
                      <span className="text-xs text-ink-soft">{g.publisher}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
