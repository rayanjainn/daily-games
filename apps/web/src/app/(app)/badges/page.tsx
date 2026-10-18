import {
  CircleCheckBig,
  Compass,
  Flame,
  History,
  ListChecks,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import type { BadgeId } from '@everydaily/shared/stats/badges';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { BadgeNews } from '@/components/game/badge-news';
import { badgesWithNews } from '@/server/badges';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Badges' };

const ICONS: Record<BadgeId, { icon: LucideIcon; tone: string }> = {
  logged: { icon: ListChecks, tone: 'bg-sky text-on-sky' },
  solved: { icon: CircleCheckBig, tone: 'bg-mint text-on-mint' },
  'daily-streak': { icon: Flame, tone: 'bg-pop text-on-pop' },
  'game-streak': { icon: Target, tone: 'bg-grape text-on-grape' },
  explorer: { icon: Compass, tone: 'bg-sun text-on-sun' },
  'catch-up': { icon: History, tone: 'bg-bubblegum text-on-bubblegum' },
};

const n = (v: number) => v.toLocaleString('en-US');

export default async function BadgesPage() {
  const { user } = await requireSession();
  const { badges, seen, news } = await badgesWithNews(user);
  const total = badges.reduce((s, b) => s + b.earned, 0);
  const levels = badges.reduce((s, b) => s + b.levels.length, 0);
  return (
    <div className="flex flex-col gap-5">
      <BadgeNews news={news} quiet />
      <div>
        <h1 className="text-3xl sm:text-4xl">Badges</h1>
        <p className="mt-1 text-ink-soft">
          {total} of {levels} milestones reached. Worked out from your own results; catch-ups count,
          but never towards a streak.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2" data-testid="badges">
        {badges.map((b) => {
          const { icon: Icon, tone } = ICONS[b.id];
          const prev = b.levels[b.earned - 1] ?? 0;
          const pct = b.next ? Math.round(((b.value - prev) / (b.next - prev)) * 100) : 100;
          return (
            <li key={b.id}>
              <Card
                className="flex h-full flex-col gap-3 p-5"
                data-badge={b.id}
                data-earned={b.earned}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-md border-[length:var(--bw)] border-line',
                      b.earned ? tone : 'bg-surface-2 text-ink-soft',
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg">{b.name}</h2>
                    <p className="text-sm text-ink-soft">
                      {b.measure}: <strong className="text-ink">{n(b.value)}</strong>
                    </p>
                  </div>
                </div>
                <ol className="flex flex-wrap gap-1.5" aria-label={`${b.name} milestones`}>
                  {b.levels.map((l, i) => {
                    const fresh = i >= (seen[b.id] ?? 0) && i < b.earned;
                    return (
                      <li
                        key={l}
                        data-new={fresh || undefined}
                        className={cn(
                          'rounded-pill border-[length:var(--bw)] px-2 py-0.5 text-xs font-bold',
                          i < b.earned
                            ? 'border-line bg-ink text-paper'
                            : 'border-line-soft text-ink-soft',
                          fresh && 'ring-2 ring-pop ring-offset-1 ring-offset-surface',
                        )}
                      >
                        {fresh ? <span aria-hidden>★ </span> : null}
                        {n(l)}
                        <span className="sr-only">
                          {fresh ? ' (reached, new)' : i < b.earned ? ' (reached)' : ''}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-auto flex flex-col gap-1">
                  <div
                    className="h-2.5 overflow-hidden rounded-pill bg-surface-2"
                    role="progressbar"
                    aria-label={`${b.name}: progress to the next milestone`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                  >
                    <div className="h-full rounded-pill bg-success" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-ink-soft">
                    {b.next
                      ? `${n(b.next - b.value)} to go for ${n(b.next)}`
                      : 'Every milestone reached'}
                  </p>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
