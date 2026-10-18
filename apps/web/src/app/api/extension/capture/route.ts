import { z } from 'zod';
import { MAX_SHARE_TEXT_LENGTH } from '@everydaily/shared/domain';
import { resolveCaptureGame } from '@everydaily/shared/catalog/capture';
import { bearer } from '@/server/capture';
import { listGames } from '@/server/catalog';
import { announceResultChange } from '@/server/groups';
import { enforceLimit, HttpError } from '@/server/http';
import { saveResult } from '@/server/results';

const schema = z
  .object({
    shareText: z.string().min(1).max(MAX_SHARE_TEXT_LENGTH),
    pageUrl: z.string().max(2048).optional(),
  })
  .strict();

/**
 * Takes share text the extension saw a game copy, works out the game, and saves it exactly as a
 * paste would. A repeat is a 409 with the saved score, never an overwrite.
 */
export const POST = bearer(schema, async ({ shareText, pageUrl }, { user }) => {
  await enforceLimit('capture-post', user.id);
  const games = await listGames();
  const match = resolveCaptureGame(games, shareText, pageUrl);
  if (!match.ok)
    throw new HttpError(
      422,
      match.code,
      match.code === 'ambiguous_game'
        ? 'More than one game could own that result. Paste it on the game page instead.'
        : 'That does not look like a result from a game in the catalog.',
    );
  const game = games.find((g) => g.slug === match.slug)!;
  const saved = await saveResult(user, game, { source: 'extension', slug: game.slug, shareText });
  await announceResultChange(user.id);
  return { game: { slug: game.slug, name: game.name }, ...saved };
});
