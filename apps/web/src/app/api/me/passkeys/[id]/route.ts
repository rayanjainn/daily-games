import { z } from 'zod';
import { and, count, eq, passkeyCredentials, recoveryPhraseHashes } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();

/** Every query is scoped to the signed-in user, so another account's id simply isn't found. */
async function owned(userId: string, id: string) {
  if (!uuid.safeParse(id).success) throw new HttpError(404, 'not_found', 'Passkey not found.');
  const rows = await db()
    .select({ id: passkeyCredentials.id })
    .from(passkeyCredentials)
    .where(and(eq(passkeyCredentials.id, id), eq(passkeyCredentials.userId, userId)))
    .limit(1);
  if (!rows.length) throw new HttpError(404, 'not_found', 'Passkey not found.');
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(
    z.object({ nickname: z.string().trim().min(1).max(40) }),
    async ({ nickname }) => {
      const { user } = await requireSession();
      await owned(user.id, id);
      await db()
        .update(passkeyCredentials)
        .set({ nickname })
        .where(and(eq(passkeyCredentials.id, id), eq(passkeyCredentials.userId, user.id)));
      return { ok: true };
    },
  )(req);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(z.object({ confirmLast: z.boolean().optional() }), async ({ confirmLast }) => {
    const { user } = await requireSession();
    await owned(user.id, id);
    const [{ n }] = (await db()
      .select({ n: count() })
      .from(passkeyCredentials)
      .where(eq(passkeyCredentials.userId, user.id))) as [{ n: number }];
    if (n <= 1) {
      const phrase = await db()
        .select({ id: recoveryPhraseHashes.userId })
        .from(recoveryPhraseHashes)
        .where(eq(recoveryPhraseHashes.userId, user.id));
      if (!phrase.length)
        throw new HttpError(
          409,
          'last_credential',
          'This is your only way in. Add another passkey or a recovery phrase first.',
        );
      if (!confirmLast) {
        throw new HttpError(
          409,
          'confirm_last',
          'This is your last passkey. After removing it you can only sign in with your recovery phrase.',
        );
      }
    }
    await db()
      .delete(passkeyCredentials)
      .where(and(eq(passkeyCredentials.id, id), eq(passkeyCredentials.userId, user.id)));
    return { ok: true };
  })(req);
}
