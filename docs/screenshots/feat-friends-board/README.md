# feat/friends-board

Phone, tablet and desktop, light and dark.

| Capture         | What it shows                                                            |
| --------------- | ------------------------------------------------------------------------ |
| `friends-board` | `/friends`: you and your friends ranked today per game, and for the week |

Checked:

- Uses the same board as groups (`server/boards.ts`, `components/board/player-board.tsx`), so
  ranking, ties and spoiler-safe hiding behave the same.
- Spoiler-safe hides friends' scores until you log that game today (`friends.spec.ts`).
- Shown only once you have at least one friend. Axe passes.
