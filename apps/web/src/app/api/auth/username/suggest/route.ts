import { query } from '@/server/http';
import { freshUsername } from '@/server/auth/accounts';

export const GET = query(async () => ({ username: await freshUsername() }));
