# feat/month-recap

Phone, tablet and desktop, light and dark, plus the rendered posters.

| Capture                  | What it shows                                                            |
| ------------------------ | ------------------------------------------------------------------------ |
| `month-poster.png`       | 1080×1350 poster for this month so far: calendar heatmap, totals, top 3  |
| `month-poster-last.png`  | The same for last month (every day counted)                              |
| `recap-month`            | `/recap` with This week, This month and Last month                       |

Checked:

- Results count in the month of their puzzle date; catch-ups count but never towards the streak
  (`month.test.ts`).
- Only months from the last two years up to this month render; anything else is 404, and the
  poster is private and uncached (`cards.spec.ts`).
