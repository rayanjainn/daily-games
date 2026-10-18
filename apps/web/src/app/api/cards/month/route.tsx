import { and, eq, games, gte, inArray, lt, results } from '@everydaily/shared/db';
import { monthOf, monthRecap } from '@everydaily/shared/stats/month';
import { addDays, localDate } from '@everydaily/shared/time/zoned';
import { cardTheme, monthPosterImage } from '@/server/cards';
import { db } from '@/server/db';
import { HttpError, query } from '@/server/http';
import { requireSession } from '@/server/session';

/** How far back a month poster can go. */
const MAX_MONTHS_BACK = 24;

/** The signed-in player's month as a poster (PNG). `?month=YYYY-MM`, default this month; `?theme=dark` for the dark card. */
export const GET = query(async (req: Request) => {
  const { user } = await requireSession();
  const today = localDate(new Date(), user.timezone);
  const asked = new URL(req.url).searchParams.get('month') ?? monthOf(today);
  const earliest = monthOf(addDays(today, -31 * MAX_MONTHS_BACK));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(asked) || asked > monthOf(today) || asked < earliest)
    throw new HttpError(404, 'not_found', 'No poster for that month.');

  const rows = await db()
    .select({
      gameId: results.gameId,
      puzzleDate: results.puzzleDate,
      solved: results.solved,
      fromArchive: results.fromArchive,
    })
    .from(results)
    .where(
      and(
        eq(results.userId, user.id),
        gte(results.puzzleDate, `${asked}-01`),
        // The 1st of the next month: the 28th plus four days is always in it.
        lt(results.puzzleDate, `${monthOf(addDays(`${asked}-28`, 4))}-01`),
      ),
    );
  const ids = [...new Set(rows.map((r) => r.gameId))];
  const gameRows = ids.length
    ? await db()
        .select({ id: games.id, name: games.name, accentColor: games.accentColor })
        .from(games)
        .where(inArray(games.id, ids))
    : [];
  return monthPosterImage({
    theme: cardTheme(new URL(req.url).searchParams.get('theme')),
    playerName: user.displayName ?? user.username,
    recap: monthRecap(asked, today, rows, gameRows),
  });
});
