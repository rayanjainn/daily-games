import type { Metadata } from 'next';
import { getDashboard, starterGames } from '@/server/dashboard';
import { picksFor } from '@/server/recommendations';
import { requireSession } from '@/server/session';
import { TodayView } from './today-view';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage() {
  const { user } = await requireSession();
  const dashboard = await getDashboard(user);
  const [starters, picks] = dashboard.items.length
    ? [[], await picksFor(user, 2)]
    : [await starterGames(user.timezone), []];
  return (
    <TodayView
      name={user.displayName || user.username}
      dashboard={dashboard}
      starters={starters}
      picks={picks}
    />
  );
}
