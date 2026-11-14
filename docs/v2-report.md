# Version 2 report

Everything below is on `main` and was tested end to end (unit, e2e with accessibility checks,
visual baselines) before merging.

## What changed

- **Sign-in is simpler.** Sign-up is two steps: pick a name, then create a passkey or a
  password. The warm-up puzzle and the recovery phrase are gone. A password (optional when you
  use a passkey) signs you in on a device without your passkey and then offers to add one there.
  Rate limits, a background proof of work and optional Turnstile still protect sign-up;
  password sign-in has an exponential lockout and gives the same answer for unknown names.
- **Answers from the source, after you play.** Nine games publish their answers: NYT Wordle,
  Connections, Strands, Pips, the Mini, Spelling Bee, Letter Boxed and Sudoku, and Contexto. Once
  you log the day's puzzle (solved or not), the game page reveals the publisher's own answer,
  linked to where it came from. Before that, the page and the API both refuse.
- **More games.** Two new originals played here: **Sixes** (a 6×6 sudoku with one solution,
  three checks and a clock) and **Glow** (lights out, scored against par). Twelve more catalog
  games: Duotrigordle, Poeltl, Weddle, Cine2Nerdle, Termo, SUTOM, Phoodle, Blossom, the Lichess
  and Chess.com daily puzzles, Polygonle and The Dozen. 94 games in all.
- **Black dark theme.** Neutral near-black surfaces in a few steps of grey; the accents still glow.
- **Quicker to get around.** A Ctrl+K / ⌘K command palette (cmdk) finds any page or game; pages
  rise in with motion (none with reduced motion); catalog cards mark games with answers.
- **Fixes.** Rankings no longer cut names short on phones.

## Risks to know

- **Answers come from public endpoints the publishers' own games use**, not a documented API.
  They can change without notice (`pnpm check:answers` shows which still work) and their terms
  may not allow reuse. Answers are shown only after a player logs the puzzle and always link to
  the source, but if a publisher objects, turn the feature off with `FEATURE_OFFICIAL_ANSWERS=0`.
- **Passwords are a weaker way in than passkeys.** They are optional, hashed with argon2id,
  checked against common passwords and locked out after repeated failures, but a reused password
  can still be phished. Passkeys stay the default.
- **The recovery phrase is gone for existing players.** They keep their passkeys and can add a
  password or email in Settings. The old table and column stay in the database until a later
  release, so the previous version keeps working during the switch.
- **Deploys now migrate the database themselves** (`pnpm release:prepare` in the production
  build), and a failure there stops the build instead of the site.

## Launch videos

Made with `/brag` (brag-slim on this model): a 20-second landscape and a vertical cut, built from
the real app with fictional players, with a soundtrack synthesised on one beat grid. The tooling
is in `scripts/promo`; the renders are not committed.
