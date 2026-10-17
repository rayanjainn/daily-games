import { z } from 'zod';
import { addComment, commentInputSchema } from '@/server/community';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { publishSafely } from '@/server/realtime';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(commentInputSchema, async (input) => {
    const { user } = await requireSession();
    await enforceLimit('comment-create', user.id);
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, 'not_found', 'Not found.');
    const created = await addComment(user, id, input);
    await publishSafely(`thread:${id}`, 'comment.created', { id: created.id });
    return created;
  })(req);
}
