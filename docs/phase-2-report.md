# Phase 2 report

Status: Phase 2 (retention) is built and merged to `main`, together with the fixes and catalog
work requested alongside it. Local unit and e2e suites pass, review screenshots are in
`docs/screenshots/`, and the history check is clean. Deployment additions are in
[DEPLOY.md](DEPLOY.md) (reminder queue, optional email).

## What shipped

**Requested fixes**

- **Speed.** `motion` was removed from the global client bundle (about 830 KB down to about
  685 KB of JavaScript per page). Every signed-in page now streams behind a skeleton instead of
  blocking. Game pages run their queries in parallel. The biggest remaining factor is outside
  the code: the Vercel function region must match the Neon region (DEPLOY.md, step 5).
- **Pointer cursors** on every clickable element, and `not-allowed` on disabled ones.
- **Dark theme** reworked as a "midnight arcade" palette: deeper navy-violet paper, lifted
  surfaces with a faint top sheen, and brighter accents. All 53 contrast checks pass, and the
  visual baselines were regenerated.

**Catalog**

- Share parsers for **Nerdle**, **Murdle** and **Clues by Sam**, built from the player's own
  share samples. All three are now Tier 1. Nerdle numbering is pinned to #1732 = 2026-10-17.
  Murdle's mystery title is never stored.
- **Krillion** (Tier 1, Daily Dive parser, 00:00 UTC reset read from its code) plus six new
  link-only games: Catfishing, MapTap, Gisnep, Globle: Capitals, Scrandle and LinkedIn Mini
  Sudoku. All were verified live and daily on 2026-10-17. The catalog now has 77 games:
  13 Tier 1, 7 Tier 2 and 57 Tier 3.

**Phase 2: retention**

- **Archive tracker.** The game page shows the last 14 puzzles since you started the game:
  played, caught up or missed. Missed days can be logged after playing them from the game's
  archive, by paste, score or check-off. Catch-ups count in stats but never in play, win or
  combined streaks (`results.from_archive`).
- **Notes per game.** A private notepad on every game page. It saves while you type and when
  the field loses focus, and the newest text always wins. It is included in the data export.
- **Community answers.** "Yesterday's answer" on the game page. Players can share the answer to
  a finished puzzle from the last week, with a required public https source. Nothing shows
  until a moderator approves it in the queue (audit-logged). The answer stays hidden until you
  click Reveal, credits the player and links to its source with `nofollow ugc`. Today's puzzle
  can never get an answer.
- **Push reminders.** These run on Cloudflare: a cron every 15 minutes, then a Queue, then Web
  Push.
  - **Per-game time.** You get a reminder at that time only if today's puzzle isn't logged
    yet.
  - **Streak at risk.** One nudge a day, naming the streaks that end unless you play.
  - **Quiet hours,** which may wrap past midnight.
  - **Timezones.** Every time is in the player's own timezone.
  - **No duplicates.** Each reminder is recorded before it is sent, so overlapping cron runs
    can't send it twice.
  - **Delivery.** Expired subscriptions are deleted, and a subscription that fails
    permanently five times is dropped. Temporary failures retry only when nothing reached the
    player.
  - **Settings.** Turn on notifications per device, send a test, and set all the times. The
    service worker shows the notifications and opens the right page when you tap one.
- **Email (optional channel).** Add an address and confirm it with a single-use link (valid 24
  hours). After that, "Also email me" sends the same reminders by email. It uses Resend's REST
  API through `fetch`, so no new dependency. Without a key, the Email section says it is off.
  An address can belong to one account only.

## Screenshots index

| Branch                                                            | Captures | Screens                                                   |
| ----------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| [feat-dark-theme](screenshots/feat-dark-theme/)                   | 36       | styleguide, today, games, game stats (before/after)       |
| [feat-archive-tracker](screenshots/feat-archive-tracker/)         | 18       | tracker strip and missed list, catch-up dialog, caught up |
| [feat-game-notes](screenshots/feat-game-notes/)                   | 12       | empty and saved notes                                     |
| [feat-community-solutions](screenshots/feat-community-solutions/) | 30       | hidden, revealed, share form error, pending, moderation   |
| [feat-push-reminders](screenshots/feat-push-reminders/)           | 12       | Reminders section empty and configured                    |
| [feat-email-channel](screenshots/feat-email-channel/)             | 18       | unconfirmed, confirmed with email reminders, link page    |

Each folder's README lists what was checked and fixed.

## Test summary

| Suite                         | Count                                    | New in this phase                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit and integration (Vitest) | **390** (shared 252, web 104, worker 34) | parsers for Nerdle, Murdle, Clues by Sam and Krillion (real, tampered, future); archive window; streaks ignoring catch-ups; reminder planning (slots, timezones, quiet hours, streak nudges); reminder DB planning with dedupe and pruning; push delivery outcomes; signed push-test route; Resend client and templates; source URL checks |
| End to end (Playwright)       | **119**                                  | archive tracker, notes (autosave, privacy, limits), community answers (share, moderate, reveal, live-puzzle and duplicate refusals), reminders (times, nudge, quiet hours, subscriptions, validation), email (confirm by link, single use, change, remove, ownership)                                                                      |
| Visual regression             | 8 baselines                              | regenerated for the new palette, larger catalog and new game-page cards                                                                                                                                                                                                                                                                    |

CI on `main` was red once in this phase: the `feat/more-games` merge. Two causes, both mine:
the new "Globle: Capitals" made a catalog test's locator ambiguous, and axe could run while the
catalog's loading skeleton (which had no h1) was on screen. Both were fixed in
`fix/catalog-test-and-skeleton-headings`; every merge since has been green.

## Embed probe

I probed the seven new games (the stored report was left unchanged):

- Krillion, Gisnep, MapTap and Globle: Capitals load in a frame.
- Catfishing and Scrandle block framing with `frame-ancestors 'none'`. LinkedIn blocks it too.

All seven stay `popout` until a publisher allows embedding, as before.

## Known gaps

- **The real notification isn't tested end to end.** Headless Chromium can't subscribe to a
  push service. Encryption and VAPID are covered in the worker tests, subscriptions and settings
  through the API, and the cron and queue planning against Postgres. The first real check is a
  "Send a test" on your phone after deploy.
- **Email is for reminders only.** It is not yet a sign-in or recovery method (section 3.6
  "email login"). The `email_tokens` table already supports a `login` purpose.
- **Answers are text only,** with no images. Moderators can approve or reject, but can't edit
  or take an answer back after approving it.
- **Notes are one notepad per game,** not dated entries.
- **Archive catch-ups need puzzle numbers in the game's share text** to be pasted. For games
  without them, use "Enter score" or the check-off for that day.
- **Visual baselines cover four screens**, as in Phase 1. The new cards are covered by the
  game-page baseline and the review captures.
