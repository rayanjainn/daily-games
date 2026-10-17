import { query } from '@/server/http';
import { usernameAvailability } from '@/server/auth/accounts';
import { suggestUsername } from '@/server/auth/username';

export const GET = query(async () => {
  for (let i = 0; i < 6; i++) {
    const name = suggestUsername();
    if ((await usernameAvailability(name)).available) return { username: name };
  }
  return { username: suggestUsername() };
});
