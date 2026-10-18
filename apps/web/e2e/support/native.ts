import { createHmac } from 'node:crypto';
import {
  cipherCode,
  makeItPuzzle,
  rngFromBytes,
  scramblePuzzle,
  scrambleCandidates,
  solveMakeIt,
} from '@everydaily/shared/native';
import { BIP39_ENGLISH } from '../../src/server/auth/wordlists/bip39';
import { SERVER_ENV } from './env';

/**
 * The same puzzles the server builds: the e2e server's secret is known here, so a test can play
 * a game properly (and the tests can tell the real answer from a wrong one).
 */
const rng = (slug: string, n: number) =>
  rngFromBytes(
    new Uint8Array(
      createHmac('sha256', SERVER_ENV.AUTH_SECRET!).update(`native:v1:${slug}:${n}`).digest(),
    ),
  );

export const cipherAnswer = (n: number) => cipherCode(rng('cipher', n));
export const scrambleAnswer = (n: number) =>
  scramblePuzzle(rng('scramble', n), scrambleCandidates(BIP39_ENGLISH));
export function makeItAnswer(n: number) {
  const puzzle = makeItPuzzle(rng('make-it', n));
  return { ...puzzle, solution: solveMakeIt(puzzle.numbers, puzzle.target)! };
}
