# Phase 3 report

Status: Phase 3 (social) and the five theme ideas are built and merged to `main`. Local unit and
e2e suites pass, review screenshots are in `docs/screenshots/`, and the history check is clean.
Deploying needs nothing new beyond Phase 1's realtime keys and Worker (DEPLOY.md); the new
tables arrive with the usual migrations (0007 to 0009).

## What shipped

**Theme ideas**

- **A colour per category.** Word, geography, logic, trivia, crossword, maths, music and visual
  games each have a colour (with a soft tint), used for badges and dots across the catalog and
  Today. Every pair passes contrast in light and dark.
- **Satisfying "done" moments.** Ticking a game off flips its tile, and the Today ring fills in
  per-game colour segments. Only changes after the page loads animate, and reduced motion turns
  the flip off.
- **Warmer light theme.** Cream paper, warmer surfaces and dots; contrast checks re-run.
- **Your recap as a poster.** See stat cards below.
- **One-colour app icon.** A monochrome icon in the manifest (`purpose: "monochrome"`) for
  Android themed icons. iOS tinting can't be controlled from a web app.

**Friends and head-to-head**

- Add friends by username; requests can be accepted, declined, removed or blocked. A block
  stops new requests and hides the head-to-head page.
- A friend's page compares the two of you over the last 90 days, game by game, for every game
  you both played.
- **Spoiler-safe mode** (Settings) hides friends' and group members' results for a puzzle until
  you've logged yours.

**Private groups**

- Create a group, share its invite link or code, rename it, regenerate the invite, remove
  members, leave (ownership passes on) or delete it.
- **Daily leaderboard** per group, plus a weekly board. Updates live (below).

**Communities**

- A global board plus one board per game. Posts and threaded comments in a safe Markdown subset
  (sanitized on the server), up and down votes, hot and new sort, flairs set by moderators.
- **Daily threads** are created automatically for each game, and their comments stay hidden
  until you've logged that day's puzzle.
- **Reports** reach the moderation queue. Moderators can remove, restore, lock and unlock; every
  action is written to the audit log. Your own posts and comments can be deleted, and both are
  included in the data export.

**Realtime**

- Live comments on posts, a live group leaderboard, who's here now (presence) and "… is
  typing".
- Each room connection uses a 60-second signed token that is only issued to members, and the
  connection re-authenticates before its deadline. Reconnects back off with jitter (0.5 s up to
  30 s) and replay missed events in order. Leaving a group or losing access stops the retries.
- Publishing is best-effort: if the realtime Worker is down, posting and logging still work and
  the page shows "offline".

**Shareable stat cards**

- A **Stat card** button on each game page: a 1200×630 image of streaks, totals and the score
  spread.
- **`/recap`**, linked from Today: a 1080×1350 poster of your last seven days as a game board,
  with totals and your streak.
- Both are drawn on the server with `next/og`, never show answers, and are sent as private,
  uncached PNGs with Share (where the browser supports sharing files) and Download.

## Screenshots index

| Branch                                              | Captures | Screens                                                  |
| --------------------------------------------------- | -------- | -------------------------------------------------------- |
| [feat-theme-polish](screenshots/feat-theme-polish/) | 13       | category colours, ring segments, warm light, mono icon   |
| [feat-friends](screenshots/feat-friends/)           | 12       | friends list and requests, head-to-head                  |
| [feat-groups](screenshots/feat-groups/)             | 18       | groups list, group board, join page                      |
| [feat-communities](screenshots/feat-communities/)   | 24       | board index, feed, post with thread, hidden daily thread |
| [feat-realtime-ui](screenshots/feat-realtime-ui/)   | 6        | live thread with presence and typing, live group board   |
| [feat-stat-cards](screenshots/feat-stat-cards/)     | 15       | week poster, game cards, `/recap`, stat card dialog      |

Each folder's README lists what was checked.

## Test summary

| Suite                         | Count                 | New in this phase                                                                                                                                                                                   |
| ----------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit and integration (Vitest) | **448** (shared 265)  | day and week ranking, head-to-head, hot score, comment threading, weekly poster, Markdown sanitizing, realtime client (backoff, resume, re-auth, typing throttle, refusal), category contrast pairs |
| End to end (Playwright)       | **134**               | friends, groups, communities (posts, votes, reports, moderation, locks, daily threads), stat cards, tile flip; realtime specs run against `wrangler dev` with `E2E_REALTIME=1`                      |
| Visual regression             | baselines regenerated | for the new nav tabs, warmer light theme, category colours and new buttons                                                                                                                          |

CI on `main`: the visual job on the `chore/retire-realtime-spike` merge failed before any test
ran, because the build couldn't download a Google font. The e2e job on the same commit passed,
and the re-run passed.

## Known gaps

- **Community moderators are the site moderators.** There are no per-board moderators yet.
- **Spoilers are whole posts or comments.** There is no inline spoiler syntax.
- **Realtime e2e is opt-in.** It needs `wrangler dev` and runs locally with `E2E_REALTIME=1`, not
  in CI. The protocol client and the room are unit-tested.
- **The iOS tinted icon** can't be set from a web app; the monochrome icon covers Android.
- **Answers are still text only** (unchanged from Phase 2).
- **Stat cards use the light palette only,** whatever theme the player uses.
