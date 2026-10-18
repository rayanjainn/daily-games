'use client';

import { ArrowLeft, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { contrastRatio, readableOn } from '@everydaily/shared/color';
import { gameRuleIssues } from '@everydaily/shared/catalog/rules';
import {
  CATEGORY_LABELS,
  DIFFICULTIES,
  EMBED_MODES,
  GAME_CATEGORIES,
  GAME_STATUSES,
  RESET_MODES,
  SCORING_TYPES,
  type Difficulty,
  type EmbedMode,
  type GameCategory,
  type GameStatus,
  type ResetMode,
  type ScoringType,
  type Tier,
} from '@everydaily/shared/domain';
import { ICON_KEYS, type IconKey } from '@everydaily/shared/registry/icons';
import { Notice } from '@/components/auth/auth-shell';
import { GameIcon } from '@/components/game/game-icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { ShareCheck } from './share-check';
import { DIFFICULTY_LABELS, EMBED_LABELS, TRACKING } from '@/lib/catalog-labels';

export interface EditableGame {
  name: string;
  publisher: string;
  description: string;
  url: string;
  category: GameCategory;
  difficulty: Difficulty;
  tier: Tier;
  embedMode: EmbedMode;
  status: GameStatus;
  resetMode: ResetMode;
  resetTz: string;
  resetHour: number;
  resetGraceHours: number;
  resetNote: string;
  puzzleEpoch: string;
  epochNumber: number;
  numberingPublic: boolean;
  parserId: string;
  scoringType: ScoringType;
  maxAttempts: number | null;
  scoringUnit: string;
  accentColor: string;
  icon: IconKey;
  attributionNote: string;
  tags: string[];
}

interface HistoryRow {
  id: string;
  action: string;
  reason: string | null;
  fields: string[];
  createdAt: string;
  actor: string | null;
}

const STATUS_LABELS: Record<GameStatus, string> = {
  active: 'Active',
  possibly_down: 'May be down',
  archived: 'Archived (hidden)',
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border-[length:var(--bw)] border-line-soft p-4 sm:p-5">
      <legend className="px-1 font-display text-lg font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function GameEditor({
  slug,
  probed,
  parsers,
  initial,
  history,
}: {
  slug: string;
  probed: string | null;
  parsers: string[];
  initial: EditableGame;
  history: HistoryRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [g, setG] = useState(initial);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof EditableGame>(k: K, v: EditableGame[K]) =>
    setG((prev) => ({ ...prev, [k]: v }));

  const issues = useMemo(
    () =>
      gameRuleIssues(
        {
          tier: g.tier,
          parserId: g.parserId || null,
          embedMode: g.embedMode,
          verifiedEmbeddableAt: probed,
          scoringType: g.scoringType,
          maxAttempts: g.maxAttempts,
          resetMode: g.resetMode,
          resetTz: g.resetTz || null,
        },
        new Set(parsers),
      ),
    [g, probed, parsers],
  );
  const readable = /^#[0-9a-f]{6}$/i.test(g.accentColor)
    ? contrastRatio(readableOn(g.accentColor), g.accentColor) >= 4.5
    : false;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ changed: boolean }>(
        `/api/admin/games/${slug}`,
        {
          ...g,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          reason: reason.trim() || undefined,
        },
        'PATCH',
      );
      toast({
        tone: res.changed ? 'success' : 'info',
        title: res.changed ? 'Saved' : 'Nothing changed',
      });
      setReason('');
      router.refresh();
    } catch (err) {
      const issuesFromServer = (
        err instanceof ApiError && Array.isArray(err.data.issues)
          ? (err.data.issues as { path: string; message: string }[])
          : []
      )
        .map((i) => `${i.path}: ${i.message}`)
        .join('; ');
      setError(
        issuesFromServer || (err instanceof ApiError ? err.message : 'Could not save. Try again.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/games"
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All games
      </Link>
      <div className="flex items-center gap-4">
        <GameIcon icon={g.icon} color={readable ? g.accentColor : '#FFFFFF'} size="md" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl sm:text-3xl">{g.name || 'Untitled'}</h1>
          <p className="text-sm text-ink-soft">
            /games/{slug} ·{' '}
            <Link href={`/games/${slug}`} className="font-semibold underline underline-offset-4">
              View page
            </Link>
          </p>
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          {error ? <Notice tone="danger">{error}</Notice> : null}

          <Group title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                {({ id }) => (
                  <Input
                    id={id}
                    value={g.name}
                    maxLength={40}
                    onChange={(e) => set('name', e.target.value)}
                  />
                )}
              </Field>
              <Field label="Publisher">
                {({ id }) => (
                  <Input
                    id={id}
                    value={g.publisher}
                    maxLength={60}
                    onChange={(e) => set('publisher', e.target.value)}
                  />
                )}
              </Field>
            </div>
            <Field label="Description" hint={`${g.description.length}/160`}>
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  value={g.description}
                  maxLength={160}
                  aria-describedby={describedBy}
                  onChange={(e) => set('description', e.target.value)}
                  className="min-h-20"
                />
              )}
            </Field>
            <Field label="Address">
              {({ id }) => (
                <Input
                  id={id}
                  type="url"
                  value={g.url}
                  onChange={(e) => set('url', e.target.value)}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Category">
                {({ id }) => (
                  <Select
                    id={id}
                    value={g.category}
                    onChange={(e) => set('category', e.target.value as GameCategory)}
                  >
                    {GAME_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Difficulty">
                {({ id }) => (
                  <Select
                    id={id}
                    value={g.difficulty}
                    onChange={(e) => set('difficulty', e.target.value as Difficulty)}
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTY_LABELS[d]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Tags" hint="Comma separated, up to 8">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    value={tags}
                    aria-describedby={describedBy}
                    onChange={(e) => setTags(e.target.value)}
                  />
                )}
              </Field>
            </div>
          </Group>

          <Group title="Tracking">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tier" hint={TRACKING[g.tier].hint}>
                {({ id, describedBy }) => (
                  <Select
                    id={id}
                    value={g.tier}
                    aria-describedby={describedBy}
                    onChange={(e) => set('tier', Number(e.target.value) as Tier)}
                  >
                    {([1, 2, 3] as const).map((t) => (
                      <option key={t} value={t}>
                        Tier {t}: {TRACKING[t].label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Parser">
                {({ id }) => (
                  <Select
                    id={id}
                    value={g.parserId}
                    onChange={(e) => set('parserId', e.target.value)}
                  >
                    <option value="">None (link only)</option>
                    {parsers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Scoring">
                {({ id }) => (
                  <Select
                    id={id}
                    value={g.scoringType}
                    onChange={(e) => set('scoringType', e.target.value as ScoringType)}
                  >
                    {SCORING_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Max attempts">
                  {({ id }) => (
                    <Input
                      id={id}
                      type="number"
                      min={1}
                      max={100}
                      value={g.maxAttempts ?? ''}
                      onChange={(e) =>
                        set('maxAttempts', e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  )}
                </Field>
                <Field label="Unit">
                  {({ id }) => (
                    <Input
                      id={id}
                      value={g.scoringUnit}
                      maxLength={20}
                      onChange={(e) => set('scoringUnit', e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </div>
            {g.parserId ? <ShareCheck slug={slug} /> : null}
          </Group>

          <Group title="Play and status">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Where it plays"
                hint={
                  probed
                    ? `Embed probe passed ${new Date(probed).toLocaleDateString()}`
                    : 'Playing here needs a passing embed probe first.'
                }
              >
                {({ id, describedBy }) => (
                  <Select
                    id={id}
                    value={g.embedMode}
                    aria-describedby={describedBy}
                    onChange={(e) => set('embedMode', e.target.value as EmbedMode)}
                  >
                    {EMBED_MODES.map((m) => (
                      <option key={m} value={m} disabled={m === 'iframe' && !probed}>
                        {EMBED_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Status">
                {({ id }) => (
                  <Select
                    id={id}
                    value={g.status}
                    onChange={(e) => set('status', e.target.value as GameStatus)}
                  >
                    {GAME_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Group>

          <Group title="Puzzle clock">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reset">
                {({ id }) => (
                  <Select
                    id={id}
                    value={g.resetMode}
                    onChange={(e) => set('resetMode', e.target.value as ResetMode)}
                  >
                    {RESET_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m === 'user_local' ? "Player's local time" : 'Fixed timezone'}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Timezone" hint="IANA name, only for fixed resets">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    value={g.resetTz}
                    placeholder="America/New_York"
                    aria-describedby={describedBy}
                    disabled={g.resetMode === 'user_local'}
                    onChange={(e) => set('resetTz', e.target.value)}
                  />
                )}
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Hour" hint="-12 to 23">
                  {({ id, describedBy }) => (
                    <Input
                      id={id}
                      type="number"
                      min={-12}
                      max={23}
                      aria-describedby={describedBy}
                      value={g.resetHour}
                      onChange={(e) => set('resetHour', Number(e.target.value))}
                    />
                  )}
                </Field>
                <Field label="Grace hours" hint="0 to 12">
                  {({ id, describedBy }) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      max={12}
                      aria-describedby={describedBy}
                      value={g.resetGraceHours}
                      onChange={(e) => set('resetGraceHours', Number(e.target.value))}
                    />
                  )}
                </Field>
              </div>
              <Field label="Reset note">
                {({ id }) => (
                  <Input
                    id={id}
                    value={g.resetNote}
                    maxLength={200}
                    onChange={(e) => set('resetNote', e.target.value)}
                  />
                )}
              </Field>
              <div className="grid grid-cols-[1.5fr_1fr] gap-4">
                <Field label="Epoch date">
                  {({ id }) => (
                    <Input
                      id={id}
                      type="date"
                      value={g.puzzleEpoch}
                      onChange={(e) => set('puzzleEpoch', e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Epoch number">
                  {({ id }) => (
                    <Input
                      id={id}
                      type="number"
                      value={g.epochNumber}
                      onChange={(e) => set('epochNumber', Number(e.target.value))}
                    />
                  )}
                </Field>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-md border-[length:var(--bw)] border-line-soft px-4 py-3">
                <span className="font-display text-sm font-semibold">
                  Game shows puzzle numbers
                </span>
                <Switch
                  checked={g.numberingPublic}
                  onCheckedChange={(v) => set('numberingPublic', v)}
                  aria-label="Game shows puzzle numbers"
                />
              </label>
            </div>
          </Group>

          <Group title="Look and attribution">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Icon">
                {({ id }) => (
                  <Select
                    id={id}
                    value={g.icon}
                    onChange={(e) => set('icon', e.target.value as IconKey)}
                  >
                    {ICON_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field
                label="Accent color"
                error={readable ? undefined : 'Needs 4.5:1 contrast with ink or white text'}
              >
                {({ id, describedBy, invalid }) => (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Pick accent color"
                      value={/^#[0-9a-f]{6}$/i.test(g.accentColor) ? g.accentColor : '#000000'}
                      onChange={(e) => set('accentColor', e.target.value.toUpperCase())}
                      className="h-12 w-14 shrink-0 cursor-pointer rounded-md border-[length:var(--bw)] border-line bg-surface p-1"
                    />
                    <Input
                      id={id}
                      value={g.accentColor}
                      maxLength={7}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      onChange={(e) => set('accentColor', e.target.value)}
                      className="font-mono"
                    />
                  </div>
                )}
              </Field>
            </div>
            <Field label="Attribution note">
              {({ id }) => (
                <Textarea
                  id={id}
                  value={g.attributionNote}
                  maxLength={240}
                  onChange={(e) => set('attributionNote', e.target.value)}
                  className="min-h-20"
                />
              )}
            </Field>
          </Group>

          {issues.length ? (
            <div
              className="flex gap-2 rounded-lg border-2 border-warn/30 bg-warn-soft p-3.5 text-sm text-warn"
              data-testid="rule-issues"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <ul className="list-inside list-disc">
                {issues.map((i) => (
                  <li key={i.path + i.message}>{i.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field label="Reason for the change (optional)" hint="Kept in the audit log">
            {({ id, describedBy }) => (
              <Input
                id={id}
                value={reason}
                maxLength={300}
                aria-describedby={describedBy}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
          <div>
            <Button type="submit" loading={busy} disabled={issues.length > 0 || !readable}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-xl">
          History
        </h2>
        {history.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="rounded-md bg-surface-2 px-3 py-2">
                <span className="font-semibold">{h.action}</span>
                {h.fields.length ? ` · ${h.fields.join(', ')}` : ''}
                <span className="text-ink-soft">
                  {' '}
                  by {h.actor ?? 'system'} · {new Date(h.createdAt).toLocaleString()}
                </span>
                {h.reason ? <p className="text-ink-soft">“{h.reason}”</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">No moderator changes yet.</p>
        )}
      </section>
    </div>
  );
}
