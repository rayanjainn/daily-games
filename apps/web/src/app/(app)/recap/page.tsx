import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { isRecapMonth, monthOf, previousMonth, recapMonths } from '@everydaily/shared/stats/month';
import { localDate } from '@everydaily/shared/time/zoned';
import { ShareImage } from '@/components/share/share-image';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { monthLabel } from '@/server/cards';
import { requireSession } from '@/server/session';
import { MonthPicker } from './month-picker';

export const metadata: Metadata = { title: 'Your recap' };

type Props = { searchParams: Promise<{ month?: string }> };

export default async function RecapPage({ searchParams }: Props) {
  const [{ user }, { month: asked }] = await Promise.all([requireSession(), searchParams]);
  const today = localDate(new Date(), user.timezone);
  const thisMonth = monthOf(today);
  const lastMonth = previousMonth(thisMonth);
  // Any month the recap covers; anything else shows the week.
  const month = asked && isRecapMonth(asked, today) ? asked : null;
  const name = user.displayName ?? user.username;
  const views = [
    { href: '/recap', label: 'This week', current: month === null },
    { href: `/recap?month=${thisMonth}`, label: 'This month', current: month === thisMonth },
    { href: `/recap?month=${lastMonth}`, label: 'Last month', current: month === lastMonth },
  ];
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link
        href="/today"
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Today
      </Link>
      <div>
        <h1 className="text-3xl sm:text-4xl">{month ? monthLabel(month) : 'Your week'}</h1>
        <p className="mt-1 text-ink-soft">
          {month
            ? 'Your month as a calendar: the greener the day, the more puzzles you logged. Totals, your longest streak and your top games.'
            : 'The last seven days as a game board: green solved, red missed the answer, pale not played.'}{' '}
          No answers on it, so it&apos;s safe to share.
        </p>
      </div>
      <nav aria-label="Recap period" className="flex flex-wrap gap-2">
        {views.map((v) => (
          <Link
            key={v.href}
            href={v.href}
            aria-current={v.current ? 'page' : undefined}
            className={cn(
              'rounded-pill border-[length:var(--bw)] border-line px-3 py-1 font-display text-sm font-semibold',
              v.current ? 'bg-ink text-paper' : 'bg-surface hover:bg-surface-2',
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      <MonthPicker
        months={recapMonths(today).map((m) => ({ value: m, label: monthLabel(m) }))}
        current={month && month !== thisMonth && month !== lastMonth ? month : null}
      />
      <Card className="p-4">
        <ShareImage
          key={month ?? 'week'}
          src={month ? `/api/cards/month?month=${month}` : '/api/cards/week'}
          filename={`everydaily-${month ?? 'week'}-${user.username}.png`}
          alt={month ? `${name}'s puzzle month, ${monthLabel(month)}` : `${name}'s puzzle week`}
          width={1080}
          height={1350}
        />
      </Card>
    </div>
  );
}
