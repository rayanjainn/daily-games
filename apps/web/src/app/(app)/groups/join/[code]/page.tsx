import { UsersRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { groupByCode, membership } from '@/server/groups';
import { requireSession } from '@/server/session';
import { JoinButton } from './join-button';

export const metadata: Metadata = { title: 'Join a group', robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const [{ code }, { user }] = await Promise.all([params, requireSession()]);
  const group = await groupByCode(code.toLowerCase());
  if (group && (await membership(user.id, group.id))) redirect(`/groups/${group.id}`);
  return (
    <Card className="mx-auto mt-6 flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
      <span className="grid size-16 place-items-center rounded-full border-[length:var(--bw)] border-line bg-sky text-on-sky shadow-lift-sm">
        <UsersRound className="size-8" aria-hidden />
      </span>
      {group ? (
        <>
          <h1 className="text-3xl">Join {group.name}?</h1>
          <p className="text-ink-soft">
            {group.members} {group.members === 1 ? 'player' : 'players'}. Members see each
            other&apos;s results on the group board.
          </p>
          <JoinButton code={code.toLowerCase()} />
        </>
      ) : (
        <>
          <h1 className="text-3xl">That invite doesn&apos;t work</h1>
          <p className="text-ink-soft">The link may have been replaced. Ask for a new one.</p>
          <Link href="/groups" className={buttonVariants({ variant: 'secondary' })}>
            Your groups
          </Link>
        </>
      )}
    </Card>
  );
}
