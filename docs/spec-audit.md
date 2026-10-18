# Spec audit

Every item in the original brief, checked against what is built. "Built" means it is on `main`
with tests. Items that can't be met, or were deliberately left, say why.

## Auth (section 3)

| Item                                                                  | Status                                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Username suggestion, availability check, profanity and reserved names | Built                                                                      |
| Puzzle gate plus rate limits, proof of work, optional Turnstile       | Built                                                                      |
| Passkeys (WebAuthn), strict origin and RP ID, single-use challenges   | Built                                                                      |
| Recovery phrase (6 words, argon2id, re-entry check, lockout backoff)  | Built                                                                      |
| Device pairing by QR with number match                                | Built                                                                      |
| Optional email: confirm, reminders                                    | Built                                                                      |
| Optional email: magic-link sign-in                                    | Built in Phase 6 (one-time, 15 minutes, newest link only, a tap to finish) |
| Multiple passkeys: add, rename, revoke; regenerate phrase             | Built                                                                      |
| Sessions: httpOnly, rotated, revocable; CSRF on mutations             | Built                                                                      |
| Warnings about losing every way in                                    | Built                                                                      |

## Features by phase (section 5)

| Phase | Item                                                                                      | Status                                                                                       |
| ----- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1     | Catalog, follow, dashboard, play flow, result logging, game stats, parsers, embed probe   | Built                                                                                        |
| 2     | Push reminders, quiet hours, streak-at-risk, optional email channel                       | Built                                                                                        |
| 2     | Notes, community solutions with moderation, yesterday's solution, archive tracker         | Built                                                                                        |
| 3     | Friends, groups, leaderboards, head-to-head, spoiler-safe mode                            | Built                                                                                        |
| 3     | Communities: posts, comments, votes, flairs, daily threads, reports, mod tools, audit log | Built, including per-board moderators and inline spoilers                                    |
| 3     | Realtime over Durable Objects, reconnect with backoff, hibernation                        | Built, tested, and run in CI                                                                 |
| 3     | Stat cards (satori)                                                                       | Built, light and dark                                                                        |
| 4     | Badges, streak freezes, weekly and monthly recap, combined daily score, recommendations   | Built                                                                                        |
| 4     | Global and friends rankings                                                               | Built: friends boards, and a rankings page (played here, verified; all games, self-reported) |
| 4     | Native games                                                                              | Three originals: Cipher, Scramble, Make It                                                   |
| Later | Browser extension                                                                         | Built in Phase 6 (MV3, bearer tokens, `/api/extension/capture`)                              |

## Catalog pipeline (5b)

Built: YAML source of truth with schema checks, 80 games, submissions behind a flag, daily health
check, weekly embed re-probe (GitHub Actions), "Report a problem", admin editing and promotion.
Phase 6 added a share-text checker in the game editor so a moderator can try a sample on a game's
parser.

## Testing protocol (6)

| Item                                                              | Status                                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Screenshots reviewed at three viewports, light and dark           | Done for every UI branch (`docs/screenshots/`)                                                           |
| Visual regression: dashboard, catalog, game page, community, auth | Built; Phase 6 added sign in, community, notifications, settings                                         |
| Auth tests with virtual authenticator, lockout, pairing, gate     | Built                                                                                                    |
| Embed probe and popout tests                                      | Built                                                                                                    |
| Parser, streak, reminder, realtime, moderation tests              | Built                                                                                                    |
| Accessibility: axe on every spec, contrast tests, reduced motion  | Built                                                                                                    |
| Accessibility: keyboard-only walkthrough                          | Built in Phase 6 (`keyboard.spec.ts`)                                                                    |
| Performance: bundle budget, image sizes                           | Built in Phase 6 (`pnpm check:budgets`, run in CI)                                                       |
| Performance: speed guards on key pages                            | Built in Phase 6 (`perf.spec.ts`, loose limits)                                                          |
| Performance: Lighthouse                                           | **Not built.** It needs a new dependency; ask first. The speed guards cover LCP and layout shift instead |
| Security: XSS, CSRF, rate limits, validation, no IDOR             | Covered in the specs for each endpoint                                                                   |
| Seed script with demo data                                        | Built                                                                                                    |

## Design (7), Security and quality (8)

| Item                                                           | Status                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Game-UI look, tokens, per-game colour and icon, light and dark | Built; the dark theme is a deep purple since Phase 6                    |
| Sound and haptics behind a setting, reduced motion             | Built in Phase 6 (Settings, Look and feel)                              |
| Dashboard with ring and combined streak                        | Built                                                                   |
| Account deletion and data export                               | Built (export includes extension access and native plays)               |
| Structured logs, error-tracking hook                           | Built in Phase 6 (JSON logs, request ids, optional `ERROR_WEBHOOK_URL`) |
| Health endpoints for web and worker                            | Built                                                                   |

## Beyond the brief

- In-app notifications inbox (friend requests, replies, decisions, removals).
- Platform stats page for the admin.

## Known gaps

- **Timed native games** can be beaten by a script written for them; Cipher is guess-limited.
- **iOS tinted icon** can't be set from a web app.
- **Community answers** are text only.
- **Extension** is Chromium (MV3) only and is installed unpacked until it is put in a store.
- **Combined streak with evening-release puzzles** uses the player's local day; a puzzle that
  releases late in the evening can count toward the next day. Not changed.
- **Hyperdrive id** in `wrangler.toml` is a placeholder to fill at deploy time.
