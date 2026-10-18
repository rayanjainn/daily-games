import type { Rng } from './rng';

export const SCRAMBLE_WORDS = 5;
const MIN_LEN = 5;
const MAX_LEN = 7;

export interface ScramblePuzzle {
  /** The letters of each word, shuffled (never the word itself). */
  scrambled: string[];
  /** The words, in order. Server side only. */
  answers: string[];
}

/** Words usable in a puzzle: plain lowercase letters, 5 to 7 long. */
export const scrambleCandidates = (words: readonly string[]) =>
  words.filter((w) => /^[a-z]+$/.test(w) && w.length >= MIN_LEN && w.length <= MAX_LEN);

const letters = (w: string) => [...w].sort().join('');

function shuffleWord(word: string, rng: Rng): string {
  if (new Set(word).size === 1) return word;
  for (let i = 0; i < 50; i++) {
    const s = rng.shuffle([...word]).join('');
    if (s !== word) return s;
  }
  // Practically unreachable; rotate so the word still changes.
  return word.slice(1) + word[0];
}

/** Five different words, each with its letters shuffled. */
export function scramblePuzzle(rng: Rng, words: readonly string[]): ScramblePuzzle {
  const pool = scrambleCandidates(words);
  if (pool.length < SCRAMBLE_WORDS * 4) throw new Error('word list too small');
  const answers: string[] = [];
  const seen = new Set<string>();
  while (answers.length < SCRAMBLE_WORDS) {
    const w = rng.pick(pool);
    // No two answers may be anagrams of each other, or the order would be ambiguous.
    if (seen.has(letters(w))) continue;
    seen.add(letters(w));
    answers.push(w);
  }
  return { scrambled: answers.map((w) => shuffleWord(w, rng)), answers };
}

/**
 * Whether `guess` solves the scrambled word: it must be made of exactly the same letters and be a
 * real word from the list, so any valid anagram counts, not only the one we had in mind.
 */
export function isScrambleSolution(
  scrambled: string,
  guess: string,
  words: ReadonlySet<string>,
): boolean {
  const g = guess.trim().toLowerCase();
  return g.length === scrambled.length && letters(g) === letters(scrambled) && words.has(g);
}

/** The text a player can share: only the time. */
export function scrambleShare(puzzleNumber: number, seconds: number): string {
  return `Scramble ${puzzleNumber.toLocaleString('en-US')} ${clock(seconds)}\n${'🟩'.repeat(SCRAMBLE_WORDS)}`;
}

export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
