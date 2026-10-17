# feat/badges

Phone, tablet and desktop, light and dark.

| Capture       | What it shows                                                                   |
| ------------- | ------------------------------------------------------------------------------- |
| `badges`      | `/badges`: six badges with their milestones, the ones reached, and what is next |
| `today-links` | Today's links to the weekly poster and to badges                                |

Checked:

- Badges are worked out from the player's results on each visit; nothing new is stored.
- Streak badges use the dashboard's rules: catch-ups count as logged and solved, never towards a
  streak (`badges.test.ts`, `badges.spec.ts`).
- Axe passes.
