import { ArrowLeft, CalendarDays, EyeOff, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LiveBoard } from '@/components/realtime/live-board';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { env } from '@/server/env';
import { groupBoard, membership } from '@/server/groups';
import { requireSession } from '@/server/session';
import { GroupManage, InviteLink, RemoveMember } from './group-actions';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ game?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { user } = await requireSession();
  const m = await membership(user.id, (await params).id);
  return { title: m?.group.name ?? 'Group' };
}

export default async function GroupPage({ params, searchParams }: Props) {
  const [{ id }, { game: slug }, { user }] = await Promise.all([
    params,
    searchParams,
    requireSession(),
  ]);
  const m = await membership(user.id, id);
  if (!m) notFound();
  const board = await groupBoard(user, id, typeof slug === 'string' ? slug : null);
  const manager = m.role !== 'member';
  const invite = new URL(`/groups/join/${m.group.inviteCode}`, env('core').APP_URL).toString();

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/groups"
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Groups
      </Link>
      <Card className="flex flex-col gap-4 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl">{m.group.name}</h1>
            <p className="mt-1 text-ink-soft">
              {board.members.length} {board.members.length === 1 ? 'player' : 'players'}
            </p>
            <LiveBoard groupId={id} />
          </div>
          <GroupManage groupId={id} name={m.group.name} role={m.role} />
        </div>
        <InviteLink groupId={id} url={invite} canReplace={manager} />
      </Card>

      <Card
        asSection
        className="flex flex-col gap-4 p-5 sm:p-6"
        aria-labelledby="today-board-heading"
      >
        <h2 id="today-board-heading" className="flex items-center gap-2 text-xl">
          <Trophy className="size-5 text-ink-soft" aria-hidden />
          Today
          {board.game ? (
            <span className="font-body text-base font-normal text-ink-soft">
              · {board.game.name} {board.game.puzzleLabel}
            </span>
          ) : null}
        </h2>
        {board.games.length > 1 ? (
          <nav aria-label="Choose a game" className="flex flex-wrap gap-2">
            {board.games.map((g) => (
              <Link
                key={g.slug}
                href={`/groups/${id}?game=${g.slug}`}
                aria-current={board.game?.slug === g.slug ? 'page' : undefined}
                className={cn(
                  'rounded-pill border-[length:var(--bw)] border-line px-3 py-1 font-display text-sm font-semibold',
                  board.game?.slug === g.slug
                    ? 'bg-ink text-paper'
                    : 'bg-surface hover:bg-surface-2',
                )}
              >
                {g.name}
              </Link>
            ))}
          </nav>
        ) : null}
        {board.hidden ? (
          <p
            className="flex items-center gap-2 rounded-md bg-info-soft p-3 text-sm text-info"
            data-testid="board-hidden"
          >
            <EyeOff className="size-4 shrink-0" aria-hidden />
            Log today&apos;s {board.game?.name} to see everyone&apos;s scores.
          </p>
        ) : null}
        {board.game ? (
          <ol className="divide-y-2 divide-line-soft" data-testid="today-board">
            {board.today.map((e) => (
              <li
                key={e.userId}
                className={cn(
                  'flex items-center justify-between gap-3 py-2.5',
                  e.userId === user.id && '-mx-2 rounded-md bg-surface-2 px-2',
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-6 text-right font-display font-bold text-ink-soft">
                    {e.rank ?? '–'}
                  </span>
                  <span className="truncate font-semibold">
                    {e.name}
                    {e.userId === user.id ? ' (you)' : ''}
                  </span>
                </span>
                {e.hidden ? (
                  <Badge tone="info">Played</Badge>
                ) : e.summary ? (
                  <Badge tone={e.solved ? 'success' : 'danger'}>{e.summary}</Badge>
                ) : (
                  <span className="text-sm text-ink-soft">Not yet</span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No games played this week" className="py-6">
            Once someone in the group logs a result, the board fills in.
          </EmptyState>
        )}
      </Card>

      <Card asSection className="flex flex-col gap-3 p-5 sm:p-6" aria-labelledby="week-heading">
        <h2 id="week-heading" className="flex items-center gap-2 text-xl">
          <CalendarDays className="size-5 text-ink-soft" aria-hidden />
          This week
          <span className="font-body text-base font-normal text-ink-soft">· every game</span>
        </h2>
        <ol className="divide-y-2 divide-line-soft" data-testid="week-board">
          {board.week.map((r) => (
            <li key={r.userId} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-6 text-right font-display font-bold text-ink-soft">
                  {r.rank}
                </span>
                <span className="truncate font-semibold">{r.name}</span>
              </span>
              <span className="text-sm">
                <strong>{r.solved}</strong> solved · {r.played} played
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card asSection className="flex flex-col gap-3 p-5 sm:p-6" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-xl">
          Members
        </h2>
        <ul className="divide-y-2 divide-line-soft" data-testid="members">
          {board.members.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2">
                <span className="font-semibold">{p.name}</span>
                {p.role !== 'member' ? <Badge tone="sun">{p.role}</Badge> : null}
              </span>
              {manager && p.role !== 'owner' && p.id !== user.id ? (
                <RemoveMember groupId={id} userId={p.id} name={p.name} />
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
