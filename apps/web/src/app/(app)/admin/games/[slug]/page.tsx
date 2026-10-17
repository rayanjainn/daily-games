import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { desc, eq, modActions, users } from '@everydaily/shared/db';
import { PARSERS } from '@everydaily/shared/parsers';
import type { IconKey } from '@everydaily/shared/registry/icons';
import { getGameBySlug } from '@/server/catalog';
import { db } from '@/server/db';
import { GameEditor } from './game-editor';

type Params = Promise<{ slug: string }>;

export const metadata: Metadata = { title: 'Edit game' };

export default async function AdminGamePage({ params }: { params: Params }) {
  const game = await getGameBySlug((await params).slug);
  if (!game) notFound();
  const history = await db()
    .select({
      id: modActions.id,
      action: modActions.action,
      reason: modActions.reason,
      after: modActions.after,
      createdAt: modActions.createdAt,
      actor: users.username,
    })
    .from(modActions)
    .leftJoin(users, eq(users.id, modActions.actorId))
    .where(eq(modActions.targetId, game.id))
    .orderBy(desc(modActions.createdAt))
    .limit(20);

  return (
    <GameEditor
      slug={game.slug}
      probed={game.verifiedEmbeddableAt?.toISOString() ?? null}
      parsers={Object.keys(PARSERS).sort()}
      initial={{
        name: game.name,
        publisher: game.publisher,
        description: game.description,
        url: game.url,
        category: game.category,
        difficulty: game.difficulty,
        tier: game.tier,
        embedMode: game.embedMode,
        status: game.status,
        resetMode: game.resetMode,
        resetTz: game.resetTz ?? '',
        resetHour: game.resetHour,
        resetGraceHours: game.resetGraceHours,
        resetNote: game.resetNote ?? '',
        puzzleEpoch: game.puzzleEpoch,
        epochNumber: game.epochNumber,
        numberingPublic: game.numberingPublic,
        parserId: game.parserId ?? '',
        scoringType: game.scoringType,
        maxAttempts: game.maxAttempts,
        scoringUnit: game.scoringUnit ?? '',
        accentColor: game.accentColor,
        icon: game.icon as IconKey,
        attributionNote: game.attributionNote,
        tags: game.tags,
      }}
      history={history.map((h) => ({
        ...h,
        fields: Object.keys((h.after as Record<string, unknown> | null) ?? {}),
        createdAt: h.createdAt.toISOString(),
      }))}
    />
  );
}
