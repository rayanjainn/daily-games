import 'server-only';
import { notFound } from 'next/navigation';
import type { User } from '@everydaily/shared/db';
import type { UserRole } from '@everydaily/shared/domain';
import { env } from './env';
import { getSession, HttpError, requireSession, type CurrentSession } from './session';

const RANK: Record<UserRole, number> = { user: 0, mod: 1, admin: 2 };

export const hasRole = (user: Pick<User, 'role'>, role: UserRole) => RANK[user.role] >= RANK[role];

/** For route handlers: 403 unless the signed-in user has at least `role`. */
export async function requireRole(role: UserRole): Promise<CurrentSession> {
  const s = await requireSession();
  if (!hasRole(s.user, role))
    throw new HttpError(403, 'forbidden', 'You do not have access to this.');
  return s;
}

/** For pages: a plain 404 for everyone below `role`, so admin routes are not advertised. */
export async function requireRolePage(role: UserRole): Promise<CurrentSession> {
  const s = await getSession();
  if (!s || !hasRole(s.user, role)) notFound();
  return s;
}

/** Whether this user may use the "Suggest a game" form right now. */
export function canSubmitGames(user: Pick<User, 'role'>): boolean {
  const flag = env('features').FEATURE_SUBMISSIONS;
  if (flag === 'off') return false;
  if (flag === 'admin') return hasRole(user, 'mod');
  return true;
}
