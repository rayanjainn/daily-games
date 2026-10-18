'use client';

import { Check, ExternalLink, Inbox, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { contrastRatio, readableOn } from '@everydaily/shared/color';
import { DIFFICULTIES, type Difficulty } from '@everydaily/shared/domain';
import { ICON_KEYS, type IconKey } from '@everydaily/shared/registry/icons';
import { GameIcon } from '@/components/game/game-icon';
import { Notice } from '@/components/auth/auth-shell';
import { ContentReportRow, type ContentReport } from '@/components/community/content-report-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { DIFFICULTY_LABELS, siteOf } from '@/lib/catalog-labels';

interface Report {
  id: string;
  kind: string;
  details: string | null;
  createdAt: string;
  game: { slug: string; name: string; status: string };
  reporter: string | null;
}
interface Submission {
  id: string;
  url: string;
  name: string;
  category: string;
  resetHint: string | null;
  sampleShareText: string | null;
  fetchedTitle: string | null;
  fetchedDescription: string | null;
  probeResult: Record<string, unknown>;
  createdAt: string;
  submitter: string | null;
}

interface PendingSolution {
  id: string;
  body: string;
  sourceUrl: string;
  puzzleNumber: number;
  puzzleDate: string;
  createdAt: string;
  game: { slug: string; name: string; numberingPublic: boolean };
  author: string;
}

const KIND_LABELS: Record<string, string> = {
  wrong_reset: 'Wrong reset time',
  moved: 'Moved',
  dead: 'Gone',
  wrong_info: 'Wrong details',
  other: 'Other',
  auto: 'Health check',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

export function ModQueue({
  reports,
  submissions,
  solutions,
  contentReports,
}: {
  reports: Report[];
  submissions: Submission[];
  solutions: PendingSolution[];
  contentReports: ContentReport[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="sr-only">Moderation queue</h1>
      <section aria-labelledby="reports-heading" className="flex flex-col gap-3">
        <h2 id="reports-heading" className="flex items-center gap-2 text-2xl sm:text-3xl">
          Reports <Badge tone={reports.length ? 'pop' : 'neutral'}>{reports.length}</Badge>
        </h2>
        {reports.length ? (
          <ul className="flex flex-col gap-3">
            {reports.map((r) => (
              <ReportRow key={r.id} report={r} />
            ))}
          </ul>
        ) : (
          <Card lift="sm">
            <EmptyState title="No open reports" className="py-6">
              Players&apos; problem reports land here.
            </EmptyState>
          </Card>
        )}
      </section>

      <section aria-labelledby="community-reports-heading" className="flex flex-col gap-3">
        <h2 id="community-reports-heading" className="flex items-center gap-2 text-2xl sm:text-3xl">
          Community reports{' '}
          <Badge tone={contentReports.length ? 'pop' : 'neutral'}>{contentReports.length}</Badge>
        </h2>
        {contentReports.length ? (
          <ul className="flex flex-col gap-3">
            {contentReports.map((r) => (
              <ContentReportRow key={r.id} report={r} />
            ))}
          </ul>
        ) : (
          <Card lift="sm">
            <EmptyState title="Nothing reported" className="py-6">
              Posts and comments players report show up here.
            </EmptyState>
          </Card>
        )}
      </section>

      <section aria-labelledby="solutions-heading" className="flex flex-col gap-3">
        <h2 id="solutions-heading" className="flex items-center gap-2 text-2xl sm:text-3xl">
          Answers <Badge tone={solutions.length ? 'pop' : 'neutral'}>{solutions.length}</Badge>
        </h2>
        {solutions.length ? (
          <ul className="flex flex-col gap-3">
            {solutions.map((s) => (
              <SolutionRow key={s.id} solution={s} />
            ))}
          </ul>
        ) : (
          <Card lift="sm">
            <EmptyState title="No answers waiting" className="py-6">
              Answers players share for past puzzles land here.
            </EmptyState>
          </Card>
        )}
      </section>

      <section aria-labelledby="subs-heading" className="flex flex-col gap-3">
        <h2 id="subs-heading" className="flex items-center gap-2 text-2xl sm:text-3xl">
          Suggestions{' '}
          <Badge tone={submissions.length ? 'pop' : 'neutral'}>{submissions.length}</Badge>
        </h2>
        {submissions.length ? (
          <ul className="flex flex-col gap-3">
            {submissions.map((s) => (
              <SubmissionRow key={s.id} sub={s} />
            ))}
          </ul>
        ) : (
          <Card lift="sm">
            <EmptyState title="No suggestions waiting" className="py-6">
              <span className="inline-flex items-center gap-1.5">
                <Inbox className="size-4" aria-hidden /> New game suggestions show up here.
              </span>
            </EmptyState>
          </Card>
        )}
      </section>
    </div>
  );
}

function SolutionRow({ solution: s }: { solution: PendingSolution }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(decision: 'approve' | 'reject') {
    setBusy(decision);
    try {
      await api(`/api/admin/solutions/${s.id}`, { decision });
      toast({ tone: 'success', title: decision === 'approve' ? 'Approved' : 'Rejected' });
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: errorText(err) });
      setBusy(null);
    }
  }

  const day = new Date(`${s.puzzleDate}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <li>
      <Card lift="sm" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">
            {s.game.name}{' '}
            <span className="text-ink-soft">
              {s.game.numberingPublic ? `#${s.puzzleNumber.toLocaleString('en-US')} · ` : ''}
              {day}
            </span>
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{s.body}</p>
          <a
            href={s.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-sm font-semibold underline decoration-2 underline-offset-2"
          >
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
            {s.sourceUrl}
          </a>
          <p className="mt-1 text-xs text-ink-soft">
            From {s.author} · {when(s.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="mint"
            loading={busy === 'approve'}
            disabled={busy !== null}
            onClick={() => decide('approve')}
          >
            <Check aria-hidden />
            Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'reject'}
            disabled={busy !== null}
            onClick={() => decide('reject')}
          >
            <X aria-hidden />
            Reject
          </Button>
        </div>
      </Card>
    </li>
  );
}

function ReportRow({ report: r }: { report: Report }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(status: 'resolved' | 'dismissed') {
    setBusy(status);
    try {
      await api(`/api/admin/reports/${r.id}`, { status });
      toast({ tone: 'success', title: status === 'resolved' ? 'Marked resolved' : 'Dismissed' });
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: errorText(err) });
      setBusy(null);
    }
  }

  return (
    <li>
      <Card lift="sm" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/games/${r.game.slug}`}
              className="font-display text-lg font-semibold underline-offset-4 hover:underline"
            >
              {r.game.name}
            </Link>
            <Badge tone="warn">{KIND_LABELS[r.kind] ?? r.kind}</Badge>
          </div>
          {r.details ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.details}</p>
          ) : null}
          <p className="mt-1 text-xs text-ink-soft">
            {r.kind === 'auto'
              ? 'Automatic health check'
              : `From ${r.reporter ?? 'a deleted account'}`}{' '}
            · {when(r.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="mint"
            loading={busy === 'resolved'}
            disabled={busy !== null}
            onClick={() => decide('resolved')}
          >
            <Check aria-hidden />
            Resolve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'dismissed'}
            disabled={busy !== null}
            onClick={() => decide('dismissed')}
          >
            Dismiss
          </Button>
        </div>
      </Card>
    </li>
  );
}

function verdictTone(v: unknown) {
  return v === 'blocked' ? 'danger' : v === 'allowed' ? 'success' : 'neutral';
}

function SubmissionRow({ sub: s }: { sub: Submission }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const probe = s.probeResult;

  async function decide(decision: 'reject' | 'duplicate') {
    setBusy(decision);
    try {
      await api(`/api/admin/submissions/${s.id}`, { decision });
      toast({ tone: 'success', title: decision === 'reject' ? 'Rejected' : 'Marked duplicate' });
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: errorText(err) });
      setBusy(null);
    }
  }

  return (
    <li>
      <Card lift="sm" className="flex flex-col gap-3 p-4" data-testid="submission">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-semibold">{s.name}</h3>
          <Badge>{s.category}</Badge>
          {typeof probe.verdict === 'string' ? (
            <Badge tone={verdictTone(probe.verdict)}>Framing: {probe.verdict}</Badge>
          ) : null}
          {typeof probe.error === 'string' ? (
            <Badge tone="danger">Fetch failed: {probe.error}</Badge>
          ) : null}
        </div>
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex w-fit max-w-full items-center gap-1.5 break-all text-sm font-semibold underline decoration-2 underline-offset-4"
        >
          {s.url}
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        </a>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          {s.fetchedTitle ? (
            <>
              <dt className="font-semibold text-ink-soft">Page title</dt>
              <dd className="break-words">{s.fetchedTitle}</dd>
            </>
          ) : null}
          {s.fetchedDescription ? (
            <>
              <dt className="font-semibold text-ink-soft">Description</dt>
              <dd className="break-words">{s.fetchedDescription}</dd>
            </>
          ) : null}
          {s.resetHint ? (
            <>
              <dt className="font-semibold text-ink-soft">Resets</dt>
              <dd className="break-words">{s.resetHint}</dd>
            </>
          ) : null}
          <dt className="font-semibold text-ink-soft">From</dt>
          <dd>
            {s.submitter ?? 'deleted account'} · {when(s.createdAt)}
          </dd>
        </dl>
        {s.sampleShareText ? (
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-2 p-3 font-mono text-xs">
            {s.sampleShareText}
          </pre>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <ApproveDialog sub={s} />
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'duplicate'}
            disabled={busy !== null}
            onClick={() => decide('duplicate')}
          >
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={busy === 'reject'}
            disabled={busy !== null}
            onClick={() => decide('reject')}
          >
            <X aria-hidden />
            Reject
          </Button>
        </div>
      </Card>
    </li>
  );
}

const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

function ApproveDialog({ sub: s }: { sub: Submission }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(slugify(s.name));
  const [name, setName] = useState(s.name);
  const [publisher, setPublisher] = useState(siteOf(s.url));
  const [description, setDescription] = useState((s.fetchedDescription ?? '').slice(0, 160));
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [accentColor, setAccent] = useState('#4361EE');
  const [icon, setIcon] = useState<IconKey>('gamepad');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const readable = /^#[0-9a-f]{6}$/i.test(accentColor)
    ? contrastRatio(readableOn(accentColor), accentColor) >= 4.5
    : false;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/submissions/${s.id}`, {
        decision: 'approve',
        slug,
        name,
        publisher,
        description,
        difficulty,
        accentColor,
        icon,
      });
      setOpen(false);
      toast({ tone: 'success', title: `${name} added as a check-off game` });
      router.refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="mint">
          <Check aria-hidden />
          Approve
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Add to catalog"
        description="Approved games start as check-off games that open on their own site."
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              {({ id }) => (
                <Input
                  id={id}
                  value={name}
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
            <Field label="Slug" hint="Used in the address">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  value={slug}
                  maxLength={40}
                  aria-describedby={describedBy}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                />
              )}
            </Field>
          </div>
          <Field label="Publisher">
            {({ id }) => (
              <Input
                id={id}
                value={publisher}
                maxLength={60}
                onChange={(e) => setPublisher(e.target.value)}
              />
            )}
          </Field>
          <Field label="Short description" hint={`${description.length}/160, at least 10`}>
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                value={description}
                maxLength={160}
                aria-describedby={describedBy}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-20"
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Difficulty">
              {({ id }) => (
                <Select
                  id={id}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABELS[d]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Icon">
              {({ id }) => (
                <Select id={id} value={icon} onChange={(e) => setIcon(e.target.value as IconKey)}>
                  {ICON_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="Accent"
              error={readable ? undefined : 'Text would be hard to read on this color'}
            >
              {({ id, describedBy, invalid }) => (
                <div className="flex items-center gap-2">
                  <input
                    id={id}
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccent(e.target.value.toUpperCase())}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    className="h-12 w-14 cursor-pointer rounded-md border-[length:var(--bw)] border-line bg-surface p-1"
                  />
                  <GameIcon icon={icon} color={accentColor} size="sm" />
                </div>
              )}
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy} disabled={!readable || description.length < 10}>
              Add game
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
