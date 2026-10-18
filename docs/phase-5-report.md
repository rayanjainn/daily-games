# Phase 5 report

Status: the gaps listed in the Phase 3 and Phase 4 reports are closed (except the two that can't
be), and the items left out of Phase 4 are built. The spec has no Phase 5, so "Phase 5" here means
what Phase 4 deliberately left for later: streak freezes, a combined daily score, original native
games and a global ranking. Everything is merged to `main`. Local unit and e2e suites pass, review
screenshots are in `docs/screenshots/`, and the history check is clean.

**Deploying:** three migrations (0010 to 0013) come with the usual migration step. Nothing else:
no new environment variables (native puzzles use `AUTH_SECRET`, so keep it secret and stable), no
new services. The e2e job in CI now also starts the worker, so the realtime specs run there.

## Gaps closed

| Gap (from)                                      | What changed                                                                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No "new badge" moment (Phase 4)                 | A toast on Today the first time a level is reached, and new levels are starred on `/badges`. What was already announced is stored on the user, so it shows once.                   |
| Picks couldn't be dismissed (Phase 4)           | A "Not interested" button on each pick. Dismissed games are stored, never suggested again, and included in the data export.                                                        |
| Friends board wasn't live (Phase 4)             | It now updates when a friend logs or removes a result, over a `friends:<your id>` room that only you can join.                                                                     |
| Month posters only for two months (Phase 4)     | An "Other month" picker covers this month back two years, the range the poster route accepts.                                                                                      |
| Stat cards were light only (Phase 3)            | Every card has a dark style (`?theme=dark`), chosen with a Light card / Dark card switch that starts from how the app looks.                                                       |
| Spoilers were whole posts or comments (Phase 3) | `\|\|text\|\|` hides part of a line behind a bar until tapped (or Enter or Space). Hidden from sight and from screen readers, and left out of previews.                            |
| Moderators were site-level only (Phase 3)       | Site moderators can appoint a moderator for one board. Board moderators see that board's reports and can remove, restore, lock, dismiss and manage flairs there, and nowhere else. |
| Realtime e2e wasn't in CI (Phase 3)             | The e2e job starts the worker (`E2E_REALTIME=1`), and the realtime specs run in CI. This also shook out two test assumptions (the push test, a vote race), both fixed.             |

## What shipped

- **Streak freezes** (combined daily streak). Every 7 days in a row earn a freeze, up to 2 are
  held, and a missed day uses one so the streak carries on (the frozen day itself isn't counted).
  Today never costs a freeze while it can still be played. They are worked out from your results
  alone, so nothing is stored and existing players get theirs retroactively. Today shows the bank
  and says when a freeze covered yesterday. Per-game streaks and the "streak at risk" reminder
  are unchanged.
- **Combined daily score.** Each result is worth points so different games can be added up: a
  missed puzzle is 0, a solved guess game is 60 to 100 (fewer guesses, more points), and a solved
  timed, point-based or check-off game is a flat 70. Catch-ups score nothing. Today shows today's
  and the week's points; the friends and group week boards now rank by points; the weekly and
  monthly posters show them.
- **Three original native games** (tier 1, played in the app, no parser):
  - **Cipher:** crack a hidden four-symbol code in eight guesses. Symbols are a colour and a
    shape, so colour isn't needed. Scored by guesses.
  - **Scramble:** unscramble five words. Any real anagram counts. Scored by time.
  - **Make It:** reach a target using four numbers once each with + − × ÷ and brackets. The
    puzzle is always solvable, and the check uses exact fractions. Scored by time.
- **Global daily board.** Each native game's page shows today's best results from everyone who
  played it here. Only results saved by playing count (source `native`), so scores can't be
  typed in or pasted, and players can hide themselves in Settings.

How the native games stay honest: each day's puzzle is built on the server from a key derived from
`AUTH_SECRET`, so it can't be worked out from the open-source code. Every move is checked on the
server, the answer reaches the browser only when a Cipher game is lost, and a finished puzzle
takes no more moves. The clock for timed games starts when the puzzle is first opened and is the
server's.

## Not built

| Item                          | Why                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Browser extension             | The spec marks it "later, do not build yet". The results API already accepts `extension` results.            |
| Global boards for other games | Their scores are typed in or pasted, so a global ranking could be faked. Native games are the verified ones. |

## Screenshots index

| Branch                                              | Captures | Screens                                                               |
| --------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| [feat-gaps](screenshots/feat-gaps/)                 | 24       | new badge levels, board moderation, inline spoilers, dark card switch |
| [feat-dark-cards](screenshots/feat-dark-cards/)     | 3        | dark week poster, month poster and game card                          |
| [feat-daily-score](screenshots/feat-daily-score/)   | 12       | Today with a freeze bank and points, and after a freeze was used      |
| [feat-native-games](screenshots/feat-native-games/) | 36       | the three games, a finished game, the global board, Today             |

## Test summary

| Suite                         | Count                            | New in this phase                                                                                                                                                                                                                                                                |
| ----------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit and integration (Vitest) | **509**                          | badge announcements; streak freezes (earning, using, the cap, today, ties with the plain streak); points; month helpers; room names; inline spoilers; native puzzles and checkers (code scoring with repeats, anagrams, exact fractions, solvable targets); native catalog rules |
| End to end (Playwright)       | **154**, all run with the worker | badge toast and marks, dismissing picks, live friends board and its privacy, dark cards, month picker, spoilers, board moderators, freezes, points, and the native games (server-side checks, forged results refused, global board ranking and opt-out)                          |
| Visual regression             | baselines regenerated            | for the new Today lines and the larger catalog                                                                                                                                                                                                                                   |

## Known gaps

- **Timed boards can be beaten by a script.** The puzzle answers are secret and results can't be
  typed in, but Scramble and Make It are solvable by a program written for them. Cipher is
  guess-limited, so it is the sturdier one.
- **Native games have no archive.** Only today's puzzle can be played, and the clock for a timed
  game starts when you open it.
- **Scramble's words come from a 2048-word list** (the recovery-phrase list), which is clear and
  unambiguous but small.
- **Freezes only cover the combined streak,** not a single game's streak, and the streak-at-risk
  reminder is per game as before.
- **Community answers are still text only,** and the iOS tinted icon can't be controlled from a web
  app. Both are unchanged.
