import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import type { Database } from '../db/client';
import { gameHealthChecks, gameReports, games, modActions } from '../db/schema';
import type { EmbedMode, GameStatus } from '../domain';
import { analyzeFrameHeaders } from '../embed/headers';

/** Consecutive failed daily checks before a game is marked possibly_down. */
export const DOWN_AFTER = 3;

export interface HealthState {
  status: GameStatus;
  consecutiveFailures: number;
}

export type HealthTransition = 'down' | 'recovered' | null;

/**
 * Daily check state machine. Failures count up; the third in a row marks an active game
 * possibly_down. One success resets the count and brings a possibly_down game back. Archived
 * games are a moderator decision and never change here.
 */
export function nextHealth(
  prev: HealthState,
  ok: boolean,
): HealthState & { transition: HealthTransition } {
  if (prev.status === 'archived')
    return {
      status: 'archived',
      consecutiveFailures: ok ? 0 : prev.consecutiveFailures + 1,
      transition: null,
    };
  if (ok) {
    return {
      status: 'active',
      consecutiveFailures: 0,
      transition: prev.status === 'possibly_down' ? 'recovered' : null,
    };
  }
  const failures = prev.consecutiveFailures + 1;
  const down = failures >= DOWN_AFTER;
  return {
    status: down ? 'possibly_down' : prev.status,
    consecutiveFailures: failures,
    transition: down && prev.status === 'active' ? 'down' : null,
  };
}

export interface PageCheck {
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  xFrameOptions: string | null;
  csp: string | null;
  error: string | null;
}

export interface CheckedGame {
  id: string;
  slug: string;
  url: string;
  status: GameStatus;
  embedMode: EmbedMode;
  consecutiveFailures: number;
}

/** Persistence the health run needs; the Drizzle implementation is below. */
export interface HealthStore {
  listGames(): Promise<CheckedGame[]>;
  record(game: CheckedGame, check: PageCheck, next: HealthState, at: Date): Promise<void>;
  setStatus(game: CheckedGame, status: GameStatus, reason: string): Promise<void>;
  /** Files an automatic report for moderators unless an open one exists for the game. */
  report(game: CheckedGame, details: string): Promise<void>;
}

export interface HealthSummary {
  checked: number;
  failed: number;
  down: string[];
  recovered: string[];
  framingLost: string[];
}

/**
 * One health run: fetch every game page, record the result, move statuses through the state
 * machine, and file reports for games that went down or whose headers now block framing while
 * the catalog says they play in a frame.
 */
export async function runHealthChecks(opts: {
  store: HealthStore;
  checkPage: (url: string) => Promise<PageCheck>;
  embedderOrigin: string;
  now?: Date;
  concurrency?: number;
}): Promise<HealthSummary> {
  const { store, checkPage, embedderOrigin } = opts;
  const now = opts.now ?? new Date();
  const list = await store.listGames();
  const summary: HealthSummary = {
    checked: 0,
    failed: 0,
    down: [],
    recovered: [],
    framingLost: [],
  };

  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const g = list[next++]!;
      const check = await checkPage(g.url).catch((err: Error): PageCheck => ({
        ok: false,
        status: null,
        finalUrl: null,
        xFrameOptions: null,
        csp: null,
        error: err.message.slice(0, 200),
      }));
      const state = nextHealth(g, check.ok);
      await store.record(g, check, state, now);
      summary.checked++;
      if (!check.ok) summary.failed++;

      if (state.transition === 'down') {
        summary.down.push(g.slug);
        await store.setStatus(g, 'possibly_down', `${DOWN_AFTER} failed checks in a row`);
        await store.report(
          g,
          `Daily check failed ${state.consecutiveFailures} times in a row (last: ${check.error ?? `HTTP ${check.status}`}).`,
        );
      } else if (state.transition === 'recovered') {
        summary.recovered.push(g.slug);
        await store.setStatus(g, 'active', 'daily check passed again');
      }

      if (check.ok && g.embedMode === 'iframe') {
        const v = analyzeFrameHeaders(
          { xFrameOptions: check.xFrameOptions, csp: check.csp },
          embedderOrigin,
          check.finalUrl ?? g.url,
        );
        if (v.verdict === 'blocked') {
          summary.framingLost.push(g.slug);
          await store.report(
            g,
            `Plays in a frame, but its headers now block framing: ${v.reason}.`,
          );
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 6, list.length) }, worker));
  return summary;
}

/** Drizzle-backed store (web, worker over Hyperdrive, tests). */
export function createHealthStore(db: Database): HealthStore {
  return {
    async listGames() {
      const rows = await db
        .select({
          id: games.id,
          slug: games.slug,
          url: games.url,
          status: games.status,
          embedMode: games.embedMode,
        })
        .from(games)
        // Our own games are part of this app: there is no other site to check.
        .where(and(ne(games.status, 'archived'), ne(games.embedMode, 'native')));
      if (!rows.length) return [];
      const last = await db
        .selectDistinctOn([gameHealthChecks.gameId], {
          gameId: gameHealthChecks.gameId,
          consecutiveFailures: gameHealthChecks.consecutiveFailures,
        })
        .from(gameHealthChecks)
        .where(
          inArray(
            gameHealthChecks.gameId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(gameHealthChecks.gameId, desc(gameHealthChecks.checkedAt));
      const failures = new Map(last.map((l) => [l.gameId, l.consecutiveFailures]));
      return rows.map((r) => ({ ...r, consecutiveFailures: failures.get(r.id) ?? 0 }));
    },
    async record(game, check, next, at) {
      await db.insert(gameHealthChecks).values({
        gameId: game.id,
        checkedAt: at,
        ok: check.ok,
        httpStatus: check.status,
        consecutiveFailures: next.consecutiveFailures,
        xFrameOptions: check.xFrameOptions?.slice(0, 200) ?? null,
        cspFrameAncestors: check.csp?.slice(0, 1000) ?? null,
        error: check.error,
      });
    },
    async setStatus(game, status, reason) {
      await db.transaction(async (tx) => {
        await tx
          .update(games)
          .set({ status, updatedAt: new Date() })
          .where(and(eq(games.id, game.id), ne(games.status, 'archived')));
        await tx.insert(modActions).values({
          actorId: null,
          action: 'game.health',
          targetType: 'game',
          targetId: game.id,
          reason,
          before: { status: game.status },
          after: { status },
        });
      });
    },
    async report(game, details) {
      const open = await db
        .select({ id: gameReports.id })
        .from(gameReports)
        .where(
          and(
            eq(gameReports.gameId, game.id),
            eq(gameReports.kind, 'auto'),
            eq(gameReports.status, 'open'),
          ),
        )
        .limit(1);
      if (open.length) return;
      await db
        .insert(gameReports)
        .values({ gameId: game.id, kind: 'auto', details: details.slice(0, 1000) });
    },
  };
}
