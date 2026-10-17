import 'server-only';
import { z } from 'zod';
import type { VoteTarget } from '@everydaily/shared/domain';
import { HttpError } from './session';

/** Validates the `[type]/[id]` part of community routes. */
export function target(type: string, id: string): { type: VoteTarget; id: string } {
  if ((type !== 'post' && type !== 'comment') || !z.string().uuid().safeParse(id).success)
    throw new HttpError(404, 'not_found', 'Not found.');
  return { type, id };
}
