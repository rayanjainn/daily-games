import { createHash, randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { e2eSql } from './db';

export interface SeededUser {
  id: string;
  username: string;
}

/**
 * Creates a user and a live session straight in the database, then sets the session cookie.
 * For specs that test signed-in features rather than sign-in itself (that has its own specs).
 */
export async function signInAs(
  page: Page,
  opts: { role?: 'user' | 'mod' | 'admin'; timezone?: string } = {},
): Promise<SeededUser> {
  const sql = e2eSql();
  try {
    const username = `t_${randomBytes(5).toString('hex')}`;
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO users (id, username, role, timezone, recovery_confirmed_at)
      VALUES (gen_random_uuid(), ${username}, ${opts.role ?? 'user'}, ${opts.timezone ?? 'UTC'}, now())
      RETURNING id`;
    const token = randomBytes(32).toString('base64url');
    await sql`
      INSERT INTO sessions (id, token_hash, user_id, expires_at, method)
      VALUES (gen_random_uuid(), ${createHash('sha256').update(token).digest('hex')}, ${user!.id},
              now() + interval '1 day', 'passkey')`;
    // The e2e server runs a production build, so cookies carry the __Host- prefix (Secure,
    // Path=/, no Domain attribute); Chrome treats http://localhost as a secure context.
    const dev = Boolean(process.env.E2E_DEV);
    await page.context().addCookies([
      {
        name: dev ? 'ed_session' : '__Host-ed_session',
        value: token,
        domain: 'localhost',
        path: '/',
        secure: !dev,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    return { id: user!.id, username };
  } finally {
    await sql.end();
  }
}
