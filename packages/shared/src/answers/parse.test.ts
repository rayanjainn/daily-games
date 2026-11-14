import { describe, expect, it } from 'vitest';
import {
  connectionsAnswer,
  contextoAnswer,
  letterBoxedAnswer,
  miniAnswer,
  pageGameData,
  pipsAnswer,
  spellingBeeAnswer,
  strandsAnswer,
  sudokuAnswer,
  wordleAnswer,
} from './parse';
import { answerSchema } from './types';
import { ANSWER_SOURCES } from './sources';

// Made-up puzzles in the same shape as each publisher's data.
const D = '2026-01-02';
const page = (data: unknown) =>
  `<html><script>window.gameData = ${JSON.stringify(data)}</script></html>`;

describe('publisher answers', () => {
  it('Wordle: the solution, only for the date asked', () => {
    const data = { solution: 'crane', print_date: D };
    expect(wordleAnswer(data, D)).toEqual({ kind: 'word', word: 'CRANE' });
    expect(wordleAnswer(data, '2026-01-03')).toBeNull();
    expect(wordleAnswer({ print_date: D }, D)).toBeNull();
  });

  it('Connections: four groups in order', () => {
    const data = {
      print_date: D,
      categories: [
        { title: 'FRUIT', cards: [{ content: 'APPLE' }, { content: 'PEAR' }] },
        { title: 'BROKEN', cards: [{}] },
      ],
    };
    expect(connectionsAnswer(data, D)).toEqual({
      kind: 'groups',
      groups: [{ title: 'FRUIT', items: ['APPLE', 'PEAR'] }],
    });
  });

  it('Strands: clue, spangram and theme words', () => {
    expect(
      strandsAnswer(
        { printDate: D, clue: 'Hot stuff', spangram: 'SPICES', themeWords: ['CUMIN'] },
        D,
      ),
    ).toEqual({ kind: 'theme', clue: 'Hot stuff', spangram: 'SPICES', words: ['CUMIN'] });
  });

  it('reads game data out of a puzzle page, and nothing from a broken one', () => {
    expect(pageGameData(page({ a: 1 }))).toEqual({ a: 1 });
    expect(pageGameData('<html>nothing</html>')).toBeNull();
    expect(pageGameData('<script>window.gameData = {oops</script>')).toBeNull();
  });

  it('Spelling Bee: letters, pangrams and the word list', () => {
    const html = page({
      today: {
        printDate: D,
        centerLetter: 'a',
        outerLetters: ['b', 'c', 'd', 'e', 'f', 'g'],
        pangrams: ['bagfaced'],
        answers: ['dab', 'bagfaced'],
      },
    });
    expect(spellingBeeAnswer(html, D)).toEqual({
      kind: 'wordlist',
      center: 'A',
      letters: 'ABCDEFG',
      pangrams: ['BAGFACED'],
      words: ['BAGFACED', 'DAB'],
    });
    expect(spellingBeeAnswer(html, '2026-01-01')).toBeNull();
  });

  it("Letter Boxed: the setter's solution for today only", () => {
    const html = page({ printDate: D, ourSolution: ['MANGO', 'OWL'] });
    expect(letterBoxedAnswer(html, D)).toMatchObject({ kind: 'sequence', words: ['MANGO', 'OWL'] });
    expect(letterBoxedAnswer(html, '2026-01-03')).toBeNull();
    const withYesterday = page({
      printDate: D,
      ourSolution: ['A'],
      yesterdaysSolution: ['PRIOR', 'ROUND'],
    });
    expect(letterBoxedAnswer(withYesterday, '2026-01-01')).toMatchObject({
      words: ['PRIOR', 'ROUND'],
    });
  });

  it('Sudoku: full 9×9 solutions per level, rejecting broken grids', () => {
    const solution = Array.from({ length: 81 }, (_, i) => (i % 9) + 1);
    const html = page({
      easy: { print_date: D, puzzle_data: { solution } },
      hard: { print_date: D, puzzle_data: { solution: [1, 2, 3] } },
    });
    const a = sudokuAnswer(html, D);
    expect(a?.kind).toBe('numbers');
    if (a?.kind !== 'numbers') return;
    expect(a.grids).toHaveLength(1);
    expect(a.grids[0]!.level).toBe('Easy');
    expect(a.grids[0]!.grid[8]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('Pips: where each domino goes', () => {
    const a = pipsAnswer(
      {
        printDate: D,
        easy: {
          dominoes: [[6, 4]],
          solution: [
            [
              [0, 0],
              [0, 1],
            ],
          ],
        },
      },
      D,
    );
    expect(a).toEqual({
      kind: 'dominoes',
      levels: [
        {
          level: 'Easy',
          placements: [
            {
              pips: [6, 4],
              cells: [
                [0, 0],
                [0, 1],
              ],
            },
          ],
        },
      ],
    });
  });

  it('Mini: the filled grid and each clue with its answer', () => {
    const cells = ['', 'C', 'A', 'T', ''].map((answer) => (answer ? { answer } : {}));
    const a = miniAnswer(
      {
        publicationDate: D,
        body: [
          {
            dimensions: { width: 5, height: 1 },
            cells,
            clues: [
              { label: '1', direction: 'Across', cells: [1, 2, 3], text: [{ plain: 'Pet' }] },
            ],
          },
        ],
      },
      D,
    );
    expect(a).toEqual({
      kind: 'crossword',
      grid: [['', 'C', 'A', 'T', '']],
      clues: [{ label: '1', direction: 'Across', clue: 'Pet', answer: 'CAT' }],
    });
  });

  it('Contexto: the word the game gives when you give up', () => {
    expect(contextoAnswer({ word: 'raisin' })).toEqual({ kind: 'word', word: 'RAISIN' });
    expect(contextoAnswer({ error: 'nope' })).toBeNull();
  });

  it('every answer the parsers make passes the shared schema', () => {
    const a = wordleAnswer({ solution: 'crane', print_date: D }, D);
    expect(answerSchema.safeParse(a).success).toBe(true);
  });

  it('sources fetch through the injected getter and survive a failed request', async () => {
    const calls: string[] = [];
    const ok = await ANSWER_SOURCES.wordle!.fetch({ date: D, number: 1 }, async (url) => {
      calls.push(url);
      return { solution: 'crane', print_date: D };
    });
    expect(calls).toEqual(['https://www.nytimes.com/svc/wordle/v2/2026-01-02.json']);
    expect(ok).toEqual({ kind: 'word', word: 'CRANE' });
    const failed = await ANSWER_SOURCES['spelling-bee']!.fetch(
      { date: D, number: 1 },
      async () => null,
    );
    expect(failed).toBeNull();
    const contexto = await ANSWER_SOURCES.contexto!.fetch({ date: D, number: 1513 }, async (u) => {
      expect(u).toBe('https://api.contexto.me/machado/en/giveup/1513');
      return { word: 'raisin' };
    });
    expect(contexto).toEqual({ kind: 'word', word: 'RAISIN' });
  });
});
