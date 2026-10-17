import type { Metadata } from 'next';
import { friendLists } from '@/server/friends';
import { requireSession } from '@/server/session';
import { FriendsView } from './friends-view';

export const metadata: Metadata = { title: 'Friends' };

export default async function FriendsPage() {
  const { user } = await requireSession();
  const lists = await friendLists(user);
  return <FriendsView me={user.username} lists={lists} />;
}
