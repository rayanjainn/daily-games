import { z } from 'zod';
import { HttpError, mutation } from '@/server/http';
import { deviceId } from '@/server/request';
import { solveGate } from '@/server/auth/gate';

const MESSAGES = {
  expired: 'That puzzle timed out. Here is a fresh one.',
  wrong: 'Not quite. Try again!',
  too_many: 'Out of tries. Here is a fresh puzzle.',
} as const;

export const POST = mutation(
  z.object({ id: z.string().max(40), answer: z.string().max(12) }),
  async ({ id, answer }) => {
    const res = await solveGate(id, answer, await deviceId());
    if (!res.ok) throw new HttpError(400, `gate_${res.reason}`, MESSAGES[res.reason]);
    return { pass: res.pass };
  },
);
