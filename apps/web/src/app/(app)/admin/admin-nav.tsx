'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/admin', label: 'Queue', exact: true },
  { href: '/admin/games', label: 'Games' },
  { href: '/admin/audit', label: 'Audit log' },
];

export function AdminNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, { href: '/admin/stats', label: 'Platform stats' }] : LINKS;
  return (
    <nav aria-label="Moderation" className="mt-2 flex gap-1 overflow-x-auto">
      {links.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-10 shrink-0 items-center rounded-md border-[length:var(--bw)] px-3.5 font-display text-sm font-semibold',
              active
                ? 'border-line bg-ink text-paper'
                : 'border-transparent text-ink-soft hover:bg-surface-2 hover:text-ink',
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
