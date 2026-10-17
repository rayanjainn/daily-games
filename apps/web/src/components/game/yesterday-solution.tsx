'use client';

import { Clock, EyeOff, Link as LinkIcon, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { MAX_SOLUTION_LENGTH } from '@everydaily/shared/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';

export interface SolutionViewProps {
  puzzleNumber: number | null;
  puzzleDate: string;
  puzzleIndex: number;
  approved: { id: string; body: string; sourceUrl: string; author: string }[];
  mine: { status: 'pending' | 'approved' | 'rejected' } | null;
}

const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');
const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/**
 * Yesterday's answer, shared by players and approved by a moderator. Hidden until the player
 * chooses to reveal it, always credited and linked to where it was published.
 */
export function YesterdaySolution({
  slug,
  gameName,
  view,
}: {
  slug: string;
  gameName: string;
  view: SolutionViewProps;
}) {
  const label = `${view.puzzleNumber !== null ? `#${view.puzzleNumber.toLocaleString('en-US')} · ` : ''}${dayLabel(view.puzzleDate)}`;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">{label}</p>
      {view.approved.length ? (
        <details
          className="group rounded-lg border-2 border-line-soft bg-surface-2"
          data-testid="solution"
        >
          <summary className="flex items-center gap-2 px-4 py-3 font-display font-semibold">
            <EyeOff className="size-4 text-ink-soft group-open:hidden" aria-hidden />
            <span className="group-open:hidden">Reveal the answer</span>
            <span className="hidden group-open:inline">Hide the answer</span>
          </summary>
          <ul className="flex flex-col divide-y-2 divide-line-soft border-t-2 border-line-soft">
            {view.approved.map((s) => (
              <li key={s.id} className="flex flex-col gap-1.5 px-4 py-3">
                <p className="whitespace-pre-wrap break-words">{s.body}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
                  <span>Shared by {s.author}</span>
                  <span aria-hidden>·</span>
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    className="inline-flex items-center gap-1 font-semibold underline decoration-2 underline-offset-2"
                  >
                    <LinkIcon className="size-3" aria-hidden />
                    Source: {host(s.sourceUrl)}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="text-sm">No answer has been shared for this puzzle yet.</p>
      )}

      {view.mine?.status === 'pending' ? (
        <p
          className="flex items-center gap-2 text-sm font-semibold text-info"
          data-testid="solution-mine"
        >
          <Clock className="size-4" aria-hidden />
          Thanks! Your answer is waiting for a moderator.
        </p>
      ) : view.mine?.status === 'rejected' ? (
        <p className="text-sm text-ink-soft" data-testid="solution-mine">
          Your answer for this puzzle wasn&apos;t approved.
        </p>
      ) : view.mine ? null : (
        <ShareDialog slug={slug} gameName={gameName} label={label} puzzleIndex={view.puzzleIndex} />
      )}
    </div>
  );
}

function ShareDialog({
  slug,
  gameName,
  label,
  puzzleIndex,
}: {
  slug: string;
  gameName: string;
  label: string;
  puzzleIndex: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api('/api/solutions', { slug, puzzleNumber: puzzleIndex, body, sourceUrl });
      setOpen(false);
      toast({ tone: 'success', title: 'Sent for review' });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.data.issues)) {
        const next: Record<string, string> = {};
        for (const i of err.data.issues as { path: string; message: string }[])
          next[i.path] ??= i.message;
        setErrors(next);
      } else {
        setErrors({ form: err instanceof ApiError ? err.message : 'Could not send. Try again.' });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="self-start">
          <Send aria-hidden />
          Share the answer
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Share the ${gameName} answer`}
        description={`For ${label}. A moderator checks it before anyone sees it.`}
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Answer" error={errors.body}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={MAX_SOLUTION_LENGTH}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className="min-h-28"
              />
            )}
          </Field>
          <Field
            label="Where it's published"
            hint="A public https link, like the game's own page or an article. We don't post answers without a source."
            error={errors.sourceUrl}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="url"
                inputMode="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
          {errors.form ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              {errors.form}
            </p>
          ) : null}
          <Button type="submit" loading={busy} className="self-start">
            Send for review
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
