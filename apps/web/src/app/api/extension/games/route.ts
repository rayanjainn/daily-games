import { hostOf } from '@everydaily/shared/catalog/capture';
import { query } from '@/server/http';
import { listGames } from '@/server/catalog';

/** Public: which sites the extension watches. Used by the options page, not for trust. */
export const GET = query(async () => {
  const games = await listGames();
  const seen = new Map<string, string>();
  for (const g of games) {
    const host = hostOf(g.url);
    if (host && g.parserId && g.embedMode !== 'native' && !seen.has(host)) seen.set(host, g.name);
  }
  return { sites: [...seen].map(([host, name]) => ({ host, name })) };
});
