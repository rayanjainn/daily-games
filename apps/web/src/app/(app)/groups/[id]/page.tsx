import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlayerBoard } from '@/components/board/player-board';
import { LiveBoard } from '@/components/realtime/live-board';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

      <PlayerBoard
        board={board}
        viewerId={user.id}
        hrefFor={(g) => `/groups/${id}?game=${g}`}
        emptyText="Once someone in the group logs a result, the board fills in."
      />

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
