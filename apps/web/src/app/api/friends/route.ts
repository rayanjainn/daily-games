import { enforceLimit, mutation } from '@/server/http';
import { requestFriend, usernameInputSchema } from '@/server/friends';
import { requireSession } from '@/server/session';

/** Sends a friend request by username (or accepts theirs, if they already asked). */
export const POST = mutation(usernameInputSchema, async ({ username }) => {
  const { user } = await requireSession();
  await enforceLimit('friend-request', user.id);
  return requestFriend(user, username);
});
