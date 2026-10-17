import { ArrowRight, ClipboardPaste, Flame, ListChecks, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BRAND } from '@everydaily/shared';
import { CATALOG_SUMMARY } from '@everydaily/shared/registry/catalog-summary';
import { Logo } from '@/components/brand/logo';
import { GameIcon } from '@/components/game/game-icon';
import { ProgressRing } from '@/components/game/progress-ring';
import { StreakFlame } from '@/components/game/streak-flame';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getSession } from '@/server/session';

const PREVIEW = [
  { slug: 'wordle', result: '3/6', done: true },
  { slug: 'connections', result: 'Perfect', done: true },
  { slug: 'globle', result: '5 guesses', done: true },
  { slug: 'strands', result: null, done: false },
  { slug: 'quordle', result: null, done: false },
];

const STEPS = [
  {
    icon: ListChecks,
    title: 'Follow your games',
    body: 'Pick from 70 daily puzzles. They line up as one checklist every morning.',
  },
  {
    icon: ClipboardPaste,
    title: 'Play, then paste',
    body: 'Open a game, play it there, paste the share text back. We read the score.',
  },
  {
    icon: Flame,
    title: 'Keep the streak',
    body: 'Streaks, personal bests and a calendar of every day you showed up.',
  },
];

export default async function Home() {
  if (await getSession()) redirect('/today');
  const byslug = new Map(CATALOG_SUMMARY.map((g) => [g.slug, g]));
  const wall = CATALOG_SUMMARY.filter((g) => g.tier <= 2)
    .concat(CATALOG_SUMMARY.filter((g) => g.tier === 3))
    .slice(0, 21);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-20 lg:pt-14">
          <div>
            <Badge tone="sun" className="mb-4">
              Wordle, Connections, Globle + {CATALOG_SUMMARY.length - 3} more
            </Badge>
            <h1 className="text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
              Every daily puzzle.
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">One streak.</span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-1 -z-0 h-4 rounded-pill bg-pop/40 sm:h-5"
                />
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft sm:text-xl">
              {BRAND.description} Free, and no passwords: you sign in with a passkey.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/start">
                  Start playing <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/login">I have an account</Link>
              </Button>
            </div>
          </div>

          {/* Product preview, built from the real components */}
          <div
            className="relative mx-auto w-full max-w-md lg:rotate-[1.5deg]"
            aria-label="Preview of the daily checklist"
            role="img"
          >
            <Card lift="lg" className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-display text-sm font-semibold uppercase tracking-wider text-ink-soft">
                    Today
                  </p>
                  <p className="font-display text-2xl font-bold">3 of 5 done</p>
                </div>
                <div className="flex items-center gap-3">
                  <StreakFlame count={42} size="md" />
                  <ProgressRing value={3} max={5} size={64} stroke={9} />
                </div>
              </div>
              <ul className="flex flex-col gap-2.5" aria-hidden>
                {PREVIEW.map((p) => {
                  const g = byslug.get(p.slug)!;
                  return (
                    <li
                      key={p.slug}
                      className="flex items-center gap-3 rounded-md border-2 border-line-soft bg-surface-2/60 p-2.5"
                    >
                      <GameIcon icon={g.icon} color={g.accentColor} size="sm" />
                      <span className="flex-1 font-display font-semibold">{g.name}</span>
                      {p.done ? <Badge tone="mint">{p.result}</Badge> : <Badge>Play</Badge>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </section>

        {/* Icon wall */}
        <section
          className="border-y-[length:var(--bw)] border-line bg-surface py-8"
          aria-label="Some of the games you can follow"
        >
          <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-3 px-4">
            {wall.map((g) => (
              <li key={g.slug} title={g.name}>
                <GameIcon icon={g.icon} color={g.accentColor} size="sm" label={g.name} />
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-3xl sm:text-4xl">How it works</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Card className="h-full p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-md border-[length:var(--bw)] border-line bg-grape text-on-grape shadow-lift-sm">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-display text-sm font-bold text-ink-soft">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="text-xl">{s.title}</h3>
                  <p className="mt-1 text-ink-soft">{s.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
          <Card tone="muted" lift="none" className="flex gap-4 p-5">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-ink-soft" aria-hidden />
            <div className="text-sm text-ink-soft">
              <p className="font-display text-base font-semibold text-ink">
                We don&apos;t make these games.
              </p>
              <p className="mt-1">
                {BRAND.name} links to each game on its own site, never copies puzzles or answers,
                and isn&apos;t affiliated with the publishers. Game names belong to their owners. We
                store your player name, passkeys and the results you log, and nothing else unless
                you add an email.
              </p>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t-[length:var(--bw)] border-line-soft py-6 text-center text-sm text-ink-soft">
        © {new Date().getFullYear()} {BRAND.name}
      </footer>
    </div>
  );
}
