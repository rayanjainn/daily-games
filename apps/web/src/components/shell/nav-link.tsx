'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function NavLink({
  href,
  variant,
  children,
}: {
  href: string;
  variant: 'top' | 'tab';
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'font-display font-semibold transition-colors',
        variant === 'top' &&
          cn(
            'inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm',
            active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
          ),
        variant === 'tab' &&
          cn(
            'flex h-16 flex-col items-center justify-center gap-0.5',
            active ? 'text-ink [&_svg]:text-pop' : 'text-ink-soft',
          ),
      )}
    >
      {children}
    </Link>
  );
}
