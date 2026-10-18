import type { Metadata } from 'next';
import { PlayerBoard } from '@/components/board/player-board';
import { LiveBoard } from '@/components/realtime/live-board';
import { playerBoard } from '@/server/boards';
import { friendLists } from '@/server/friends';
import { requireSession } from '@/server/session';
import { FriendsView } from './friends-view';

export const metadata: Metadata = { title: 'Friends' };

type Props = { searchParams: Promise<{ game?: string }> };

export default async function FriendsPage({ searchParams }: Props) {
  const [{ user }, { game }] = await Promise.all([requireSession(), searchParams]);
  const lists = await friendLists(user);
  // You and your friends on one board; nothing to rank until you have a friend.
  const board = lists.friends.length
    ? await playerBoard(
        user,
        [
          { id: user.id, name: user.displayName ?? user.username },
          ...lists.friends.map((f) => ({ id: f.id, name: f.displayName ?? f.username })),
        ],
        typeof game === 'string' ? game : null,
      )
    : null;
  return (
    <FriendsView me={user.username} lists={lists}>
      {board ? <LiveBoard room={`friends:${user.id}`} /> : null}
      {board ? (
        <PlayerBoard
          board={board}
          viewerId={user.id}
          hrefFor={(slug) => `/friends?game=${slug}`}
          emptyText="Once you or a friend logs a result, the board fills in."
        />
      ) : null}
    </FriendsView>
  );
}
