import type { Metadata } from 'next';
import { myGroups } from '@/server/groups';
import { requireSession } from '@/server/session';
import { GroupsView } from './groups-view';

export const metadata: Metadata = { title: 'Groups' };

export default async function GroupsPage() {
  const { user } = await requireSession();
  return <GroupsView groups={await myGroups(user.id)} />;
}
