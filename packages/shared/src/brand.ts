/**
 * Product identity. Renaming the product is a change to `name` here.
 * Hosts, the WebAuthn RP ID and cookie names come from env, not from this file:
 * passkeys are bound to the RP ID, so it must never change as a side effect of a rename.
 */
export const BRAND = {
  name: 'EveryDaily',
  tagline: 'All your daily puzzles. One streak.',
  shortName: 'EveryDaily',
  description:
    'Follow, play and track daily puzzle games like Wordle, Connections and Globle in one place.',
  themeColor: '#FF5B2E',
  backgroundColor: '#FFF7EA',
} as const;

export type Brand = typeof BRAND;
