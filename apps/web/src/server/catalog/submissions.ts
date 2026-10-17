import 'server-only';
import { gameSubmissions, games, type User } from '@everydaily/shared/db';
import type { GameSubmissionInput } from '@everydaily/shared/catalog/rules';
import { analyzeFrameHeaders } from '@everydaily/shared/embed/headers';
import { normalizeGameUrl } from '@everydaily/shared/registry';
import { db } from '../db';
import { env } from '../env';
import { HttpError } from '../session';
import { fetchPageMeta } from './fetch-page';

const isUniqueViolation = (e: unknown) =>
  (e as { code?: string })?.code === '23505' ||
  (e as { cause?: { code?: string } })?.cause?.code === '23505';

/**
 * Queues a game suggestion for moderators: dedupe against the catalog and open suggestions,
 * fetch only the page's title, description and framing headers, then store it as pending.
 * A failed fetch never blocks the suggestion; moderators see why it failed.
 */
export async function createSubmission(user: Pick<User, 'id'>, input: GameSubmissionInput) {
  let key: string;
  try {
    key = normalizeGameUrl(input.url);
  } catch {
    throw new HttpError(400, 'invalid_input', 'That does not look like a web address.');
  }

  const existing = (await db().select({ slug: games.slug, url: games.url }).from(games)).find(
    (g) => normalizeGameUrl(g.url) === key,
  );
  if (existing)
    throw new HttpError(409, 'already_listed', 'That game is already in the catalog.', {
      slug: existing.slug,
    });

  let probe: Record<string, unknown>;
  let title: string | null = null;
  let description: string | null = null;
  try {
    const page = await fetchPageMeta(input.url);
    title = page.title;
    description = page.description;
    probe = {
      status: page.status,
      finalUrl: page.finalUrl,
      xFrameOptions: page.headers.xFrameOptions,
      csp: page.headers.csp?.slice(0, 1000) ?? null,
      ...analyzeFrameHeaders(page.headers, env('core').APP_URL, page.finalUrl),
    };
  } catch (err) {
    probe = { error: (err as Error).message.slice(0, 200) };
  }

  try {
    const [row] = await db()
      .insert(gameSubmissions)
      .values({
        submittedBy: user.id,
        url: input.url,
        normalizedKey: key,
        name: input.name,
        category: input.category,
        resetHint: input.resetHint || null,
        sampleShareText: input.sampleShareText || null,
        fetchedTitle: title,
        fetchedDescription: description,
        probeResult: probe,
      })
      .returning({ id: gameSubmissions.id });
    return { id: row!.id };
  } catch (e) {
    if (isUniqueViolation(e))
      throw new HttpError(409, 'already_suggested', 'Someone already suggested this game. Thanks!');
    throw e;
  }
}
