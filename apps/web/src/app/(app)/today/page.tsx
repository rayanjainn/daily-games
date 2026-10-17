import type { Metadata } from 'next';
import { getDashboard, starterGames } from '@/server/dashboard';
import { requireSession } from '@/server/session';
import { TodayView } from './today-view';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage() {
  const { user } = await requireSession();
  const dashboard = await getDashboard(user);
  const starters = dashboard.items.length ? [] : await starterGames(user.timezone);
  return (
    <TodayView name={user.displayName || user.username} dashboard={dashboard} starters={starters} />
  );
}
