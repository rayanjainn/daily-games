# feat/streak-freezes and feat/daily-score

Phone, tablet and desktop, light and dark.

| Capture             | What it shows                                                                    |
| ------------------- | -------------------------------------------------------------------------------- |
| `today-freeze`      | Today with an 8-day streak, one banked freeze, and "154 pts today · 658 this week" |
| `today-freeze-used` | The note shown the day after a freeze covered a missed day                       |

How the two work:

- **Streak freezes** (combined daily streak only): every 7 days in a row earn one, up to 2 are
  held, and a missed day uses one so the streak carries on (the frozen day itself isn't counted
  in the length). Today never costs a freeze while it can still be played. Worked out from the
  results alone, so nothing is stored (`streak.test.ts`).
- **Combined score**: a missed puzzle is 0; a solved guess game is 60–100 (fewer guesses, more
  points); a solved timed, point-based or check-off game is a flat 70. Catch-ups score nothing
  (`points.test.ts`). It shows on Today, on the friends and group week boards (which now rank
  by points) and on the weekly and monthly posters.
