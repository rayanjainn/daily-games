import { z } from 'zod';
import { bearer } from '@/server/capture';

/** Lets the extension's options page check that the address and token work. */
export const GET = bearer(z.object({}), async (_in, { user }) => ({
  ok: true,
  username: user.username,
}));
