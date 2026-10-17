# feat/stat-cards

Shareable images drawn on the server with `next/og`. Phone, tablet and desktop, light and dark.

| Capture                 | What it shows                                                                     |
| ----------------------- | --------------------------------------------------------------------------------- |
| `week-poster.png`       | The 1080×1350 weekly poster: one row per game, a tile per day, totals and streak  |
| `game-card-wordle.png`  | A 1200×630 game card with streaks, totals and the guess spread                    |
| `game-card-tradle.png`  | The same card for a check-off game (no spread, no solve rate)                     |
| `recap`                 | `/recap`: the poster with Share (where the browser supports files) and Download   |
| `stat-card-dialog`      | The "Stat card" button on a game page opens its card in a dialog                  |

Checked:

- Images contain counts and streaks only, never answers, and are sent with `private, no-store`.
- Signed-out requests get 401; unknown games get 404 (`cards.spec.ts`).
- The poster's week helper is unit-tested (`week.test.ts`).
