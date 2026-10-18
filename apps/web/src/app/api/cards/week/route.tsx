import { and, eq, gte, inArray, results } from '@everydaily/shared/db';
import { weekPoster } from '@everydaily/shared/stats/week';
import { addDays } from '@everydaily/shared/time/zoned';
import { cardTheme, weekPosterImage } from '@/server/cards';
import { getDashboard } from '@/server/dashboard';
import { db } from '@/server/db';
import { query } from '@/server/http';
import { requireSession } from '@/server/session';

/** The signed-in player's week as a poster: followed games × the last seven days (PNG). `?theme=dark` for the dark card. */
export const GET = query(async (req: Request) => {
  const { user } = await requireSession();
  const dash = await getDashboard(user);
  const gameIds = dash.items.map((i) => i.game.id);
  const rows = gameIds.length
    ? await db()
        .select({
          gameId: results.gameId,
          puzzleDate: results.puzzleDate,
          solved: results.solved,
          attempts: results.attempts,
          maxAttempts: results.maxAttempts,
          fromArchive: results.fromArchive,
        })
        .from(results)
        .where(
          and(
            eq(results.userId, user.id),
            inArray(results.gameId, gameIds),
            gte(results.puzzleDate, addDays(dash.today, -6)),
          ),
        )
    : [];
  const poster = weekPoster(
    dash.today,
    dash.items.map((i) => ({
      name: i.game.name,
      accentColor: i.game.accentColor,
      scoringType: i.game.scoringType,
      results: rows.filter((r) => r.gameId === i.game.id),
    })),
  );
  return weekPosterImage({
    theme: cardTheme(new URL(req.url).searchParams.get('theme')),
    playerName: user.displayName ?? user.username,
    poster,
    streak: dash.combined.current,
  });
});
