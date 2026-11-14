import {
  connectionsAnswer,
  contextoAnswer,
  letterBoxedAnswer,
  miniAnswer,
  pipsAnswer,
  spellingBeeAnswer,
  strandsAnswer,
  sudokuAnswer,
  wordleAnswer,
} from './parse';
import type { AnswerSource } from './types';

const NYT = 'nytimes.com';
const nyt = (path: string) => `https://www.nytimes.com${path}`;

/**
 * Games whose publisher makes the day's answer available, keyed by catalog slug. Each one was
 * checked by hand against the live source. The dated endpoints keep old days; the puzzle pages
 * only show the current one, so those answers are cached the first time someone asks.
 */
export const ANSWER_SOURCES: Record<string, AnswerSource> = {
  wordle: {
    label: NYT,
    pageUrl: () => nyt('/games/wordle/index.html'),
    fetch: async ({ date }, get) =>
      wordleAnswer(await get(nyt(`/svc/wordle/v2/${date}.json`), 'json'), date),
  },
  connections: {
    label: NYT,
    pageUrl: () => nyt('/games/connections'),
    fetch: async ({ date }, get) =>
      connectionsAnswer(await get(nyt(`/svc/connections/v2/${date}.json`), 'json'), date),
  },
  strands: {
    label: NYT,
    pageUrl: () => nyt('/games/strands'),
    fetch: async ({ date }, get) =>
      strandsAnswer(await get(nyt(`/svc/strands/v2/${date}.json`), 'json'), date),
  },
  pips: {
    label: NYT,
    pageUrl: () => nyt('/games/pips'),
    fetch: async ({ date }, get) =>
      pipsAnswer(await get(nyt(`/svc/pips/v1/${date}.json`), 'json'), date),
  },
  'nyt-mini': {
    label: NYT,
    pageUrl: () => nyt('/crosswords/game/mini'),
    fetch: async ({ date }, get) =>
      miniAnswer(await get(nyt('/svc/crosswords/v6/puzzle/mini.json'), 'json'), date),
  },
  'spelling-bee': {
    label: NYT,
    pageUrl: () => nyt('/puzzles/spelling-bee'),
    fetch: async ({ date }, get) => {
      const html = await get(nyt('/puzzles/spelling-bee'), 'text');
      return typeof html === 'string' ? spellingBeeAnswer(html, date) : null;
    },
  },
  'letter-boxed': {
    label: NYT,
    pageUrl: () => nyt('/puzzles/letter-boxed'),
    fetch: async ({ date }, get) => {
      const html = await get(nyt('/puzzles/letter-boxed'), 'text');
      return typeof html === 'string' ? letterBoxedAnswer(html, date) : null;
    },
  },
  'nyt-sudoku': {
    label: NYT,
    pageUrl: () => nyt('/puzzles/sudoku'),
    fetch: async ({ date }, get) => {
      const html = await get(nyt('/puzzles/sudoku'), 'text');
      return typeof html === 'string' ? sudokuAnswer(html, date) : null;
    },
  },
  contexto: {
    label: 'contexto.me',
    pageUrl: () => 'https://contexto.me/',
    fetch: async ({ number }, get) =>
      number >= 0
        ? contextoAnswer(await get(`https://api.contexto.me/machado/en/giveup/${number}`, 'json'))
        : null,
  },
};

export const hasAnswerSource = (slug: string) => slug in ANSWER_SOURCES;
