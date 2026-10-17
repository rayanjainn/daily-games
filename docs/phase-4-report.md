# Phase 4 report

Status: the low-risk half of Phase 4 (delight) is built and merged to `main`. The rest was left
out on purpose, as agreed, and is listed under "Not built" with the reason for each. Local unit
and e2e suites pass, review screenshots are in `docs/screenshots/`, and the history check is
clean. Nothing new is needed to deploy: no new tables, keys or services.

## What shipped

- **Friends leaderboard.** `/friends` ranks you and your friends on today's puzzle for each game,
  and across the week. It uses the same board as groups (`server/boards.ts`), so ranking, ties
  and spoiler-safe hiding behave the same in both places.
- **Badges and milestones.** `/badges` has six badges: puzzles logged, puzzles solved, longest
  daily streak, longest streak in one game, different games played, and archive catch-ups. Each
  has levels and shows the progress to the next one. Badges are worked out from your results on
  each visit, so nothing new is stored, and catch-ups never count towards a streak. Linked from
  Today.
- **Monthly recap.** `/recap` now offers This week, This month and Last month. The month poster
  (1080×1350) is a calendar heatmap of puzzles per day, with totals, the longest streak inside
  the month, the top three games and the busiest weekday. Like the other cards it shows no
  answers and is private and uncached. Only months from the last two years render.
- **Recommendations.** Once you follow a game, Today shows two "Picked for you" games, each with
  its reason. Games your friends follow rank first, then games in categories you already play,
  then popular games.

## Not built (left for later)

| Item                 | Why it was left out                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global rankings      | Scores are self-reported, so a global board can be faked. Friends and group boards are fine because people know each other. A global board could later use native games only. |
| Streak freezes       | They change how every streak is counted (dashboard, stats, badges, reminders), and the existing tests pin those rules down.                                                   |
| Combined daily score | Needs a decision on how to compare guesses, times, points and check-offs across games.                                                                                        |
| Native games (2–3)   | The largest piece: each needs a daily puzzle generator, answer checking on the server and original artwork.                                                                   |
| Browser extension    | Marked "later" in the spec. The results API already accepts results from any client with a session.                                                                           |

## Screenshots index

| Branch                                                    | Captures | Screens                                               |
| --------------------------------------------------------- | -------- | ----------------------------------------------------- |
| [feat-friends-board](screenshots/feat-friends-board/)     | 6        | friends page with today's and the week's board        |
| [feat-badges](screenshots/feat-badges/)                   | 12       | badges page, Today's links                            |
| [feat-month-recap](screenshots/feat-month-recap/)         | 8        | month posters (this month, last month), `/recap` tabs |
| [feat-recommendations](screenshots/feat-recommendations/) | 6        | "Picked for you" on Today                             |

Each folder's README lists what was checked.

## Test summary

| Suite                         | Count                           | New in this phase                                                                                                                                           |
| ----------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit and integration (Vitest) | **462**                         | badge levels and streak rules, month recap (partial months, catch-ups, top games, weekdays), recommendation ranking                                         |
| End to end (Playwright)       | **136** passed, 2 skipped       | friends board with spoiler-safe hiding, badges, month poster and its refusals, picks with following from Today. The 2 skipped are the opt-in realtime specs |
| Visual regression             | dashboard baselines regenerated | for the badges and recap links and the picks (masked, since they depend on other players)                                                                   |

## Known gaps

- **Badges aren't announced.** There's no "new badge" moment when you reach a level; you see it
  on `/badges`. That would need to remember what was already shown.
- **Picks use simple signals.** No play history beyond categories, and no way to dismiss a pick.
- **The friends board isn't live.** Group boards update in real time; the friends board updates
  on reload.
- **Month posters go back two years,** and only this month and last month are offered on
  `/recap`.
