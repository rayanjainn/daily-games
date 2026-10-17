import 'server-only';
import { headers } from 'next/headers';

export interface CurrentUser {
  id: string;
  username: string;
}

/**
 * Resolves the signed-in user.
 * Session auth lands with the passkey branches; until then a development-only header identity
 * exists so the realtime path can be exercised end to end. It is disabled in production builds.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.NODE_ENV === 'production') return null;
  const h = await headers();
  const id = h.get('x-dev-user-id');
  const username = h.get('x-dev-username');
  if (!id || !username || !/^[a-z0-9-]{1,64}$/.test(id) || !/^[a-z0-9_]{3,20}$/.test(username))
    return null;
  return { id, username };
}
