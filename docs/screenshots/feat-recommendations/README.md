# feat/recommendations

Phone, tablet and desktop, light and dark.

| Capture       | What it shows                                                                 |
| ------------- | ----------------------------------------------------------------------------- |
| `today-picks` | "Picked for you" on Today: two games to follow, each with the reason it's there |

Checked:

- Picks only appear once you follow at least one game (new players still get the starter picks).
- Ranking: friends following a game count most, then categories you already follow (capped),
  then overall popularity on a log scale (`recommend.test.ts`).
- Following a pick adds it to the checklist and replaces the pick (`dashboard.spec.ts`).
- The visual baseline masks the two picks, since they depend on what other players follow.
