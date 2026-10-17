'use client';

import { Bell, Flame, Play, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { confettiBurst } from '@/components/game/confetti';
import { ProgressRing } from '@/components/game/progress-ring';
import { StreakFlame } from '@/components/game/streak-flame';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';

const SWATCHES = [
  ['paper', 'ink'],
  ['surface', 'ink'],
  ['surface-2', 'ink'],
  ['pop', 'on-pop'],
  ['grape', 'on-grape'],
  ['mint', 'on-mint'],
  ['sun', 'on-sun'],
  ['sky', 'on-sky'],
  ['bubblegum', 'on-bubblegum'],
  ['danger', 'on-danger'],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export function StyleguideClient() {
  const toast = useToast();
  const [chips, setChips] = useState<string[]>(['Word']);
  const [username, setUsername] = useState('brave_otter_12');
  const [notify, setNotify] = useState(true);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <ThemeToggle />
      </header>

      <div>
        <h1 className="text-4xl sm:text-5xl">Design system</h1>
        <p className="mt-2 max-w-prose text-lg text-ink-soft">
          Tokens and core components. Every color pair here is contrast-checked in both themes.
        </p>
      </div>

      <Section title="Color">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SWATCHES.map(([bg, fg]) => (
            <div
              key={bg}
              className="flex h-24 flex-col justify-end rounded-lg border-[length:var(--bw)] border-line p-3 shadow-lift-sm"
              style={{ background: `var(--${bg})`, color: `var(--${fg})` }}
            >
              <span className="font-display text-sm font-semibold">{bg}</span>
              <span className="text-xs">text: {fg}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <Card className="flex flex-col gap-3 p-5">
          <p className="font-display text-5xl font-bold leading-none">Play every day</p>
          <p className="font-display text-3xl font-semibold">Today&apos;s puzzles</p>
          <p className="font-display text-xl font-semibold">Wordle · 4/6 · 12-day streak</p>
          <p className="max-w-prose text-md">
            Body copy is Nunito: rounded, friendly and very legible at small sizes. Numbers use
            tabular figures so scores line up:{' '}
            <span className="tabular-nums">1,204 · 3:47 · 98%</span>.
          </p>
          <p className="text-sm text-ink-soft">Secondary text for hints and metadata.</p>
        </Card>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Play aria-hidden /> Play now
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="grape">
            <Sparkles aria-hidden /> Grape
          </Button>
          <Button variant="mint">Mint</Button>
          <Button variant="sun">Sun</Button>
          <Button variant="danger">
            <Trash2 aria-hidden /> Delete
          </Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" variant="secondary" aria-label="Add">
            <Plus aria-hidden />
          </Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
        <Button size="lg" block className="sm:max-w-sm">
          Start playing
        </Button>
      </Section>

      <Section title="Cards and tiles">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <h3 className="text-lg">Plain card</h3>
            <p className="text-sm text-ink-soft">Outlined, lifted surface.</p>
          </Card>
          <Card interactive className="p-5" tabIndex={0}>
            <h3 className="text-lg">Interactive</h3>
            <p className="text-sm text-ink-soft">Hover lifts, press sinks.</p>
          </Card>
          <Card tone="muted" lift="none" className="p-5">
            <h3 className="text-lg">Muted, flat</h3>
            <p className="text-sm text-ink-soft">For secondary groupings.</p>
          </Card>
        </div>
      </Section>

      <Section title="Chips and badges">
        <div className="flex flex-wrap gap-2">
          {['Word', 'Geography', 'Logic', 'Trivia', 'Math', 'Music'].map((c) => (
            <Chip
              key={c}
              selected={chips.includes(c)}
              onClick={() =>
                setChips((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]))
              }
            >
              {c}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Tier 3</Badge>
          <Badge tone="pop">New</Badge>
          <Badge tone="grape">Native</Badge>
          <Badge tone="mint">Solved</Badge>
          <Badge tone="sun">
            <Flame aria-hidden /> Hot
          </Badge>
          <Badge tone="sky">Popout</Badge>
          <Badge tone="success">Done today</Badge>
          <Badge tone="warn">Possibly down</Badge>
          <Badge tone="danger">Failed</Badge>
          <Badge tone="info">Info</Badge>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Username" hint="3–20 letters, numbers or underscores.">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            )}
          </Field>
          <Field label="Username" error="That name is taken. Try brave_otter_13?">
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                defaultValue="admin"
              />
            )}
          </Field>
          <Field label="Search games">
            {({ id }) => (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft"
                  aria-hidden
                />
                <Input id={id} placeholder="Wordle, Globle, Connections…" className="pl-11" />
              </div>
            )}
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-lg border-[length:var(--bw)] border-line bg-surface p-4">
            <div>
              <p className="font-display font-semibold">Daily reminder</p>
              <p className="text-sm text-ink-soft">Nudge me at 8:00 if I haven&apos;t played.</p>
            </div>
            <Switch checked={notify} onCheckedChange={setNotify} aria-label="Daily reminder" />
          </div>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="stats">
          <TabsList>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="stats">
            <Card className="p-5">Distribution, averages and personal bests.</Card>
          </TabsContent>
          <TabsContent value="history">
            <Card className="p-5">Every result you have logged.</Card>
          </TabsContent>
          <TabsContent value="notes">
            <Card className="p-5">Your private notes and learnings.</Card>
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Progress and streaks">
        <div className="flex flex-wrap items-end gap-8">
          <ProgressRing value={0} max={5} sublabel="today" />
          <ProgressRing value={3} max={5} sublabel="today" color="var(--sun)" />
          <ProgressRing value={5} max={5} />
          <ProgressRing value={2} max={4} size={64} stroke={9} />
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <StreakFlame count={42} size="lg" />
          <StreakFlame count={12} state="at-risk" size="lg" />
          <StreakFlame count={0} state="out" size="lg" />
          <StreakFlame count={7} size="sm" />
        </div>
      </Section>

      <Section title="Feedback">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="mint"
            onClick={() =>
              toast({ tone: 'success', title: 'Result saved', body: 'Wordle 1,214 · 4/6' })
            }
          >
            Success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({ tone: 'info', title: 'Heads up', body: 'Globle resets in 2 hours.' })
            }
          >
            Info toast
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              toast({
                tone: 'error',
                title: "Couldn't read that",
                body: 'Paste the share text from the game.',
              })
            }
          >
            Error toast
          </Button>
          <Button variant="sun" onClick={(e) => confettiBurst({ x: e.clientX, y: e.clientY })}>
            <Sparkles aria-hidden /> Confetti
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="grape">
                <Bell aria-hidden /> Open dialog
              </Button>
            </DialogTrigger>
            <DialogContent
              title="Turn on reminders?"
              description="We'll send one nudge a day, at the time you pick."
            >
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <DialogClose asChild>
                  <Button>Turn on</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="secondary">Not now</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Section>

      <Section title="Empty, loading and error states">
        <div className="grid gap-4 md:grid-cols-3">
          <EmptyState title="No games yet" action={<Button size="sm">Browse games</Button>}>
            Follow a few puzzles and they&apos;ll show up here every day.
          </EmptyState>
          <EmptyState art="search" title="Nothing matches">
            Try a different name, or clear the filters.
          </EmptyState>
          <EmptyState
            art="oops"
            title="Something broke"
            action={
              <Button size="sm" variant="secondary">
                Try again
              </Button>
            }
          >
            We couldn&apos;t load this. It&apos;s us, not you.
          </EmptyState>
        </div>
        <Card className="flex flex-col gap-3 p-5" aria-busy>
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-24 w-full" />
        </Card>
      </Section>

      <Section title="Long text">
        <Card className="p-5">
          <h3 className="text-lg break-words">
            Supercalifragilisticexpialidocious-word-puzzle-with-a-very-long-name-that-keeps-going
          </h3>
          <p className="break-words text-ink-soft">
            pneumonoultramicroscopicsilicovolcanoconiosis — long unbroken strings wrap instead of
            overflowing the card.
          </p>
        </Card>
      </Section>
    </main>
  );
}
