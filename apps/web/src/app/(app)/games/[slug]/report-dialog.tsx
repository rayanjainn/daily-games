'use client';

import { Flag } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

const KINDS = [
  { value: 'wrong_reset', label: 'Wrong reset time', hint: 'The puzzle changes at another time' },
  { value: 'moved', label: 'It moved', hint: 'The game lives at a new address' },
  { value: 'dead', label: "It's gone", hint: 'The site is down or the game ended' },
  { value: 'wrong_info', label: 'Wrong details', hint: 'Name, publisher or description' },
  { value: 'other', label: 'Something else', hint: 'Tell us below' },
] as const;
type Kind = (typeof KINDS)[number]['value'];

export function ReportDialog({ slug, gameName }: { slug: string; gameName: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!kind) return setError('Pick what is wrong.');
    if (kind === 'other' && !details.trim()) return setError('Tell us a little about the problem.');
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ duplicate: boolean }>(`/api/games/${slug}/report`, {
        kind,
        details: details.trim() || undefined,
      });
      setOpen(false);
      setKind(null);
      setDetails('');
      toast({
        tone: 'success',
        title: res.duplicate ? 'You already reported this' : 'Thanks, report sent',
        body: res.duplicate ? 'A moderator will look at it soon.' : 'A moderator will take a look.',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Flag aria-hidden />
          Report a problem
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Report a problem"
        description={`What's wrong with ${gameName}? Moderators review every report.`}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Problem</legend>
            {KINDS.map((k) => (
              <label
                key={k.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border-[length:var(--bw)] p-3 transition-colors',
                  kind === k.value
                    ? 'border-line bg-surface-2 shadow-lift-sm'
                    : 'border-line-soft hover:bg-surface-2',
                )}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                  className="mt-1 size-4 accent-[var(--pop)]"
                />
                <span>
                  <span className="block font-display font-semibold">{k.label}</span>
                  <span className="block text-sm text-ink-soft">{k.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Field label="Details (optional)" error={error ?? undefined}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={details}
                maxLength={1000}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="For example: it now resets at 9 AM, or the new address"
              />
            )}
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              Send report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
