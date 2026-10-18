import { z } from 'zod';
import { consumeLoginToken } from '@/server/email';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { clientIp } from '@/server/request';
import { startSession } from '@/server/session';

/** Signs in with an emailed link. The link is used up even if the sign-in then fails. */
export const POST = mutation(
  z.object({ token: z.string().max(200) }).strict(),
  async ({ token }) => {
    await enforceLimit('email-login-confirm', await clientIp());
    const out = await consumeLoginToken(token);
    if (!out.ok)
      throw new HttpError(
        400,
        out.reason === 'expired' ? 'link_expired' : 'link_invalid',
        out.reason === 'expired'
          ? 'That link has expired. Ask for a new one.'
          : 'That link has already been used or is not valid. Ask for a new one.',
      );
    await startSession(out.userId, 'email');
    return { ok: true };
  },
);
