'use client';

import { ArrowLeft, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { CATEGORY_LABELS, GAME_CATEGORIES, type GameCategory } from '@everydaily/shared/domain';
import { Notice } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useHydrated } from '@/lib/use-hydrated';

const isWebAddress = (s: string) => {
  try {
    const u = new URL(s);
    return (u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.hostname);
  } catch {
    return false;
  }
};

type Errors = Partial<Record<'url' | 'name' | 'category' | 'form', string>>;

export function SuggestForm() {
  const hydrated = useHydrated();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GameCategory | ''>('');
  const [resetHint, setResetHint] = useState('');
  const [sample, setSample] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ listed?: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!isWebAddress(url.trim())) next.url = 'Paste the full address, starting with https://';
    if (!name.trim()) next.name = 'What is the game called?';
    if (!category) next.category = 'Pick the closest category.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api('/api/submissions', {
        url: url.trim(),
        name: name.trim(),
        category,
        resetHint: resetHint.trim() || undefined,
        sampleShareText: sample.trim() || undefined,
      });
      setDone({});
    } catch (err) {
      if (err instanceof ApiError && err.code === 'already_listed')
        return setDone({ listed: String(err.data.slug) });
      if (err instanceof ApiError && err.code === 'invalid_input')
        setErrors({ form: 'Some fields need another look.' });
      else
        setErrors({ form: err instanceof ApiError ? err.message : 'Could not send. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 p-8 text-center">
        <span className="grid size-16 place-items-center rounded-full border-[length:var(--bw)] border-line bg-sun text-on-sun shadow-lift-sm">
          <PartyPopper className="size-8" aria-hidden />
        </span>
        {done.listed ? (
          <>
            <h1 className="text-2xl">Already here!</h1>
            <p className="text-ink-soft">That game is in the catalog. Follow it from its page.</p>
            <Button asChild>
              <Link href={`/games/${done.listed}`}>Open the game</Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl">Thanks for the tip</h1>
            <p className="text-ink-soft">
              A moderator will check that it is live and daily. Approved games join the catalog with
              check-off tracking.
            </p>
            <Button asChild variant="secondary">
              <Link href="/games">Back to games</Link>
            </Button>
          </>
        )}
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link
        href="/games"
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All games
      </Link>
      <div>
        <h1 className="text-3xl sm:text-4xl">Suggest a game</h1>
        <p className="mt-1 text-ink-soft">
          Know a daily puzzle we are missing? We only read the page title and description, then a
          moderator takes a look.
        </p>
      </div>
      <Card className="p-5 sm:p-6">
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          {errors.form ? <Notice tone="danger">{errors.form}</Notice> : null}
          <Field label="Game address" error={errors.url}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://"
                value={url}
                maxLength={500}
                onChange={(e) => setUrl(e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" error={errors.name}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  value={name}
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </Field>
            <Field label="Category" error={errors.category}>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GameCategory)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                >
                  <option value="">Choose one</option>
                  {GAME_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field
            label="When does a new puzzle come out? (optional)"
            hint="For example: midnight local time"
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                value={resetHint}
                maxLength={120}
                onChange={(e) => setResetHint(e.target.value)}
                aria-describedby={describedBy}
              />
            )}
          </Field>
          <Field
            label="Sample share text (optional)"
            hint="Paste what the game copies when you share a result. It helps us track scores."
          >
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                value={sample}
                maxLength={1000}
                onChange={(e) => setSample(e.target.value)}
                aria-describedby={describedBy}
                className="font-mono text-sm"
              />
            )}
          </Field>
          <div>
            <Button type="submit" loading={busy} disabled={!hydrated}>
              Send suggestion
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
