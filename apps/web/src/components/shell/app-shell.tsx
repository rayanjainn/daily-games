import {
  CalendarCheck,
  Gamepad2,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { NotificationBell } from '@/components/notifications/bell';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { NavLink } from './nav-link';

const NAV = [
  { href: '/today', label: 'Today', icon: CalendarCheck },
  { href: '/games', label: 'Games', icon: Gamepad2 },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/c', label: 'Community', icon: MessagesSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;
const ADMIN = { href: '/admin', label: 'Admin', icon: ShieldCheck } as const;

/**
 * Signed-in frame: top bar with nav on larger screens; a thumb-reachable tab bar on phones.
 */
export function AppShell({ children, isMod = false }: { children: ReactNode; isMod?: boolean }) {
  const nav = isMod ? [...NAV, ADMIN] : NAV;
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b-[length:var(--bw)] border-line-soft bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/today" className="rounded-md" aria-label="EveryDaily, today">
            <Logo className="[&_span]:max-[360px]:hidden" />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href} variant="top">
                <n.icon className="size-4" aria-hidden />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-12">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t-[length:var(--bw)] border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="grid auto-cols-fr grid-flow-col">
          {nav.map((n) => (
            <li key={n.href}>
              <NavLink href={n.href} variant="tab">
                <n.icon className="size-6" aria-hidden />
                <span className="text-xs">{n.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
