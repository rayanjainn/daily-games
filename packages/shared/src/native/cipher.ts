import type { Rng } from './rng';

/** Symbols to choose from, slots in the code, and guesses allowed. */
export const CIPHER_SYMBOLS = 6;
export const CIPHER_SLOTS = 4;
export const CIPHER_MAX_GUESSES = 8;

export type CipherCode = number[];

/** The day's hidden code: four symbols (0 to 5), repeats allowed. */
export function cipherCode(rng: Rng): CipherCode {
  return Array.from({ length: CIPHER_SLOTS }, () => rng.int(CIPHER_SYMBOLS));
}

export function isCipherGuess(guess: unknown): guess is number[] {
  return (
    Array.isArray(guess) &&
    guess.length === CIPHER_SLOTS &&
    guess.every((g) => Number.isInteger(g) && g >= 0 && g < CIPHER_SYMBOLS)
  );
}

export interface CipherFeedback {
  /** Right symbol in the right slot. */
  exact: number;
  /** Right symbol, wrong slot. */
  misplaced: number;
}

/** Scores a guess the usual way: exact matches first, then the leftover symbols that appear. */
export function cipherFeedback(code: readonly number[], guess: readonly number[]): CipherFeedback {
  let exact = 0;
  const left = Array<number>(CIPHER_SYMBOLS).fill(0);
  const loose = Array<number>(CIPHER_SYMBOLS).fill(0);
  for (let i = 0; i < CIPHER_SLOTS; i++) {
    if (guess[i] === code[i]) exact++;
    else {
      left[code[i]!]!++;
      loose[guess[i]!]!++;
    }
  }
  let misplaced = 0;
  for (let s = 0; s < CIPHER_SYMBOLS; s++) misplaced += Math.min(left[s]!, loose[s]!);
  return { exact, misplaced };
}

export const isCracked = (f: CipherFeedback) => f.exact === CIPHER_SLOTS;

/** One share row: green for each exact, yellow for each misplaced, black for the rest. */
export function cipherRow(f: CipherFeedback): string {
  return (
    '🟩'.repeat(f.exact) +
    '🟨'.repeat(f.misplaced) +
    '⬛'.repeat(CIPHER_SLOTS - f.exact - f.misplaced)
  );
}

/** The text a player can share: no symbols, only how each guess scored. */
export function cipherShare(
  puzzleNumber: number,
  attempts: number,
  solved: boolean,
  rows: CipherFeedback[],
): string {
  return [
    `Cipher ${puzzleNumber.toLocaleString('en-US')} ${solved ? attempts : 'X'}/${CIPHER_MAX_GUESSES}`,
    '',
    ...rows.map(cipherRow),
  ]
    .join('\n')
    .trimEnd();
}
