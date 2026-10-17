import type { Metadata } from 'next';
import { asc, eq, gameReports, gameSubmissions, games, users } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { openContentReports } from '@/server/community';
import { pendingSolutions } from '@/server/solutions';
import { ModQueue } from './mod-queue';

export const metadata: Metadata = { title: 'Moderation queue' };

export default async function AdminQueuePage() {
  const [reports, submissions, solutionRows, contentRows] = await Promise.all([
    db()
      .select({
        id: gameReports.id,
        kind: gameReports.kind,
        details: gameReports.details,
        createdAt: gameReports.createdAt,
        game: { slug: games.slug, name: games.name, status: games.status },
        reporter: users.username,
      })
      .from(gameReports)
      .innerJoin(games, eq(games.id, gameReports.gameId))
      .leftJoin(users, eq(users.id, gameReports.userId))
      .where(eq(gameReports.status, 'open'))
      .orderBy(asc(gameReports.createdAt))
      .limit(100),
    db()
      .select({
        id: gameSubmissions.id,
        url: gameSubmissions.url,
        name: gameSubmissions.name,
        category: gameSubmissions.category,
        resetHint: gameSubmissions.resetHint,
        sampleShareText: gameSubmissions.sampleShareText,
        fetchedTitle: gameSubmissions.fetchedTitle,
        fetchedDescription: gameSubmissions.fetchedDescription,
        probeResult: gameSubmissions.probeResult,
        createdAt: gameSubmissions.createdAt,
        submitter: users.username,
      })
      .from(gameSubmissions)
      .leftJoin(users, eq(users.id, gameSubmissions.submittedBy))
      .where(eq(gameSubmissions.status, 'pending'))
      .orderBy(asc(gameSubmissions.createdAt))
      .limit(100),
    pendingSolutions(),
    openContentReports(),
  ]);

  return (
    <ModQueue
      reports={reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      submissions={submissions.map((s) => ({
        ...s,
        probeResult: (s.probeResult ?? {}) as Record<string, unknown>,
        createdAt: s.createdAt.toISOString(),
      }))}
      solutions={solutionRows.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
      contentReports={contentRows}
    />
  );
}
