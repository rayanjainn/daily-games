import { PROFANITY } from './wordlists/profanity';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Names that could be mistaken for staff, system pages or the product. */
const RESERVED = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'mod',
  'mods',
  'moderator',
  'staff',
  'team',
  'official',
  'everydaily',
  'every_daily',
  'api',
  'app',
  'www',
  'mail',
  'email',
  'login',
  'logout',
  'signin',
  'signup',
  'register',
  'settings',
  'account',
  'security',
  'billing',
  'privacy',
  'terms',
  'about',
  'today',
  'games',
  'game',
  'stats',
  'friends',
  'groups',
  'community',
  'communities',
  'notifications',
  'null',
  'undefined',
  'anonymous',
  'deleted',
  'everyone',
  'here',
  'nyt',
  'nytimes',
  'wordle',
  'owner',
  'bot',
]);

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
};
const BAD = new Set(PROFANITY);
const BAD_LONG = PROFANITY.filter((w) => w.length >= 5);

export type UsernameProblem =
  'too_short' | 'too_long' | 'charset' | 'underscore_edge' | 'reserved' | 'profanity';

export function normalizeUsername(input: string): string {
  return input.normalize('NFKC').trim().toLowerCase();
}

/**
 * Format, reserved-name and profanity rules. Profanity matching is token-based for short words
 * (so "classic_bass" is fine) and substring-based for long ones, after undoing simple leetspeak.
 */
export function checkUsername(raw: string): UsernameProblem | null {
  const name = normalizeUsername(raw);
  if (name.length < USERNAME_MIN) return 'too_short';
  if (name.length > USERNAME_MAX) return 'too_long';
  if (!/^[a-z0-9_]+$/.test(name)) return 'charset';
  if (name.startsWith('_') || name.endsWith('_') || name.includes('__')) return 'underscore_edge';
  if (RESERVED.has(name) || RESERVED.has(name.replace(/_/g, ''))) return 'reserved';

  const deleet = name.replace(/[0-9]/g, (d) => LEET[d] ?? d);
  const tokens = [...name.split(/[_0-9]+/), ...deleet.split('_')].filter(Boolean);
  if (tokens.some((t) => BAD.has(t))) return 'profanity';
  const joined = deleet.replace(/_/g, '');
  if (BAD_LONG.some((w) => joined.includes(w))) return 'profanity';
  return null;
}

export const USERNAME_MESSAGES: Record<UsernameProblem | 'taken', string> = {
  too_short: `Use at least ${USERNAME_MIN} characters.`,
  too_long: `Keep it to ${USERNAME_MAX} characters or fewer.`,
  charset: 'Use lowercase letters, numbers and underscores only.',
  underscore_edge: "Underscores can't start or end a name, or come in pairs.",
  reserved: 'That name is reserved. Try something more you.',
  profanity: "Let's keep it friendly. Try a different name.",
  taken: 'Someone already has that one.',
};

const ADJECTIVES = [
  'brave',
  'calm',
  'clever',
  'cosmic',
  'daring',
  'dizzy',
  'eager',
  'fancy',
  'fizzy',
  'gentle',
  'giddy',
  'glad',
  'golden',
  'happy',
  'jolly',
  'keen',
  'lucky',
  'mellow',
  'merry',
  'mighty',
  'nimble',
  'noble',
  'peppy',
  'plucky',
  'proud',
  'quick',
  'quiet',
  'rapid',
  'shiny',
  'silly',
  'snappy',
  'sneaky',
  'snug',
  'sparky',
  'speedy',
  'spry',
  'sunny',
  'swift',
  'tidy',
  'witty',
  'zany',
  'zesty',
  'bold',
  'bright',
  'chill',
  'crisp',
  'curious',
  'dapper',
];
const NOUNS = [
  'otter',
  'fox',
  'panda',
  'koala',
  'badger',
  'beaver',
  'falcon',
  'gecko',
  'heron',
  'lemur',
  'llama',
  'lynx',
  'moose',
  'narwhal',
  'owl',
  'puffin',
  'quokka',
  'raccoon',
  'robin',
  'seal',
  'sloth',
  'squid',
  'tiger',
  'walrus',
  'wombat',
  'yak',
  'zebra',
  'comet',
  'pickle',
  'muffin',
  'noodle',
  'pebble',
  'pixel',
  'puzzle',
  'rocket',
  'tile',
  'waffle',
  'cactus',
  'acorn',
  'kiwi',
  'mango',
  'biscuit',
  'meteor',
  'marble',
  'domino',
  'sprout',
  'button',
  'clover',
];

/** adjective_noun_NN; always passes `checkUsername`. */
export function suggestUsername(rand: () => number = Math.random): string {
  for (;;) {
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
    const name = `${pick(ADJECTIVES)}_${pick(NOUNS)}_${10 + Math.floor(rand() * 90)}`;
    if (name.length <= USERNAME_MAX && !checkUsername(name)) return name;
  }
}
