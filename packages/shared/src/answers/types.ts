import { z } from 'zod';

/**
 * The answer to one day's puzzle, as the publisher itself gives it. Each kind is shown its own
 * way. Nothing here is guessed or reconstructed: if the publisher's data isn't there, there's
 * no answer.
 */
export const answerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('word'), word: z.string().min(1).max(40) }),
  z.object({
    kind: z.literal('groups'),
    groups: z
      .array(z.object({ title: z.string().max(120), items: z.array(z.string().max(60)).max(8) }))
      .min(1)
      .max(8),
  }),
  z.object({
    kind: z.literal('theme'),
    clue: z.string().max(200),
    spangram: z.string().max(40),
    words: z.array(z.string().max(40)).max(20),
  }),
  z.object({
    kind: z.literal('wordlist'),
    letters: z.string().max(10),
    center: z.string().max(1),
    pangrams: z.array(z.string().max(30)).max(20),
    words: z.array(z.string().max(30)).max(200),
  }),
  z.object({
    kind: z.literal('sequence'),
    words: z.array(z.string().max(30)).min(1).max(10),
    note: z.string().max(200).optional(),
  }),
  z.object({
    kind: z.literal('crossword'),
    grid: z.array(z.array(z.string().max(4))).max(25),
    clues: z
      .array(
        z.object({
          label: z.string().max(6),
          direction: z.enum(['Across', 'Down']),
          clue: z.string().max(300),
          answer: z.string().max(30),
        }),
      )
      .max(80),
  }),
  z.object({
    kind: z.literal('numbers'),
    grids: z
      .array(z.object({ level: z.string().max(20), grid: z.array(z.array(z.number().int())) }))
      .max(4),
  }),
  z.object({
    kind: z.literal('dominoes'),
    levels: z
      .array(
        z.object({
          level: z.string().max(20),
          placements: z.array(
            z.object({
              pips: z.tuple([z.number(), z.number()]),
              cells: z.array(z.tuple([z.number(), z.number()])),
            }),
          ),
        }),
      )
      .max(4),
  }),
]);
export type Answer = z.infer<typeof answerSchema>;

export interface AnswerSource {
  /** Shown as "Answer from …". */
  label: string;
  /** Where a player can check it themselves. */
  pageUrl: (date: string) => string;
  /**
   * The answer for one puzzle. `date` is the puzzle's date (YYYY-MM-DD) and `number` its number
   * in our catalog. Returns null when the publisher has no answer for that day (yet, or any more).
   */
  fetch: (p: { date: string; number: number }, get: Getter) => Promise<Answer | null>;
}

/** Fetches a URL and returns its body, or null on any HTTP failure. Injected so tests run offline. */
export type Getter = (url: string, as: 'json' | 'text') => Promise<unknown | null>;
