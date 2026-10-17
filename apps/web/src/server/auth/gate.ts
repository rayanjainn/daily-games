import 'server-only';
import { randomInt } from 'node:crypto';
import { randomToken, signToken, verifyToken } from '../crypto';
import { redis } from '../redis';

/**
 * The puzzle gate: a 20-second unscramble that sets the tone of the product. It is light
 * friction, not bot protection — a script can solve it. Proof of work, rate limits and
 * (optionally) Turnstile do the real work and still apply when the gate is bypassed.
 */
const WORDS = [
  'TILES',
  'STREAK',
  'PUZZLE',
  'DAILY',
  'CLUES',
  'GRIDS',
  'WORDS',
  'SOLVE',
  'GUESS',
  'BOARD',
  'SCORE',
  'MATCH',
];
const TTL_SECONDS = 120;
export const GATE_PASS_TTL = 15 * 60;

interface GateRecord {
  answer: string;
  device: string;
  attempts: number;
}

function scramble(word: string): string[] {
  const letters = word.split('');
  for (;;) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [letters[i], letters[j]] = [letters[j]!, letters[i]!];
    }
    if (letters.join('') !== word) return letters;
  }
}

export async function startGate(device: string) {
  const answer = WORDS[randomInt(WORDS.length)]!;
  const id = randomToken(12);
  await redis().set<GateRecord>(`gate:${id}`, { answer, device, attempts: 0 }, { ex: TTL_SECONDS });
  return { id, letters: scramble(answer), seconds: 20 };
}

export type GateResult =
  { ok: true; pass: string } | { ok: false; reason: 'expired' | 'wrong' | 'too_many' };

export async function solveGate(id: string, guess: string, device: string): Promise<GateResult> {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(id)) return { ok: false, reason: 'expired' };
  const key = `gate:${id}`;
  const rec = await redis().get<GateRecord>(key);
  if (!rec || rec.device !== device) return { ok: false, reason: 'expired' };
  if (guess.toUpperCase() !== rec.answer) {
    if (rec.attempts + 1 >= 3) {
      await redis().del(key);
      return { ok: false, reason: 'too_many' };
    }
    await redis().set<GateRecord>(key, { ...rec, attempts: rec.attempts + 1 }, { keepTtl: true });
    return { ok: false, reason: 'wrong' };
  }
  await redis().del(key);
  return { ok: true, pass: signToken('gate', { d: device }, GATE_PASS_TTL) };
}

export function checkGatePass(pass: string | undefined, device: string): boolean {
  const data = verifyToken<{ d: string }>('gate', pass);
  return !!data && data.d === device;
}
