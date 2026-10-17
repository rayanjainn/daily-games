# Phase 1 report

Status: Phase 1 is built end to end and merged to `main`. The tests pass, the screenshots are
reviewed, the embed probe report exists and the history check is clean. Deployment steps are in
[DEPLOY.md](DEPLOY.md).

## What shipped

**Foundation**

- pnpm monorepo: `apps/web` (Next.js 16 on Vercel), `apps/worker` (Cloudflare Workers),
  `packages/shared` and `scripts`.
- CI runs format, lint, typecheck, unit tests and the history check, then e2e and visual
  regression in a pinned Playwright image.
- Design system v1: tokens for light and dark, a game-style component set, original game icons,
  and `/styleguide` in development.
- Postgres schema with migrations, including an append-only moderation audit log enforced by a
  trigger.

**Auth (section 3)**

- Passkey sign-up: username suggestions with live checks, a puzzle gate, proof of work, rate
  limits, optional Turnstile, and a recovery phrase with a 2-word check.
- Sign-in through passkey autofill and a button.
- Recovery-phrase sign-in with lockout.
- QR device pairing with number matching.
- Settings: passkeys, sessions, phrase rotation, export, account deletion, and the account-loss
  warning.
- Sessions are httpOnly with `__Host-` cookies, rotate on login and can be revoked. CSRF
  protection uses a double-submit token plus an Origin check.

**Catalog (5b)**

- 70 verified games in YAML (9 Tier 1, 7 Tier 2, 54 Tier 3) with a zod schema, puzzle-number
  math and seeding that preserves moderator edits.
- `/games` has search, category, difficulty, tracking and play-mode filters, a Following filter,
  and filters kept in the URL.
- Game pages show today's puzzle, the reset time converted to your clock, an "isn't affiliated"
  attribution and "Report a problem".
- "Suggest a game" is behind `FEATURE_SUBMISSIONS` (moderators only at launch). It applies an
  SSRF guard, dedupe and a header probe.
- Moderation tools: a queue for reports and suggestions, a game editor that enforces the tier
  rules, and the audit log. Roles change only through `pnpm user:role`.
- The worker runs a daily health check: three failures mark a game `possibly_down` and file an
  automatic report, and `iframe` games whose headers start blocking framing get flagged.

**Play, log, stats**

- Dashboard (`/today`): followed games as a checklist, a progress ring, a combined streak,
  reordering, and confetti on a full day (skipped when the user prefers reduced motion).
- Play flow:
  - Popout opens only from a click: a side window on desktop, a new tab on phones.
  - If the popup is blocked, a fallback link appears.
  - When you return, the app asks for your result.
  - A sandboxed iframe host with an 8-second watchdog exists for probe-verified games.
  - Native games have a placeholder.
- Result logging:
  - Paste share text and see a preview, using 9 dedicated parsers plus a generic one; or enter
    a score by hand; or tick off Tier 3 games.
  - Malformed, tampered, duplicate and future results are rejected; undo is available.
  - The results API accepts `source: 'extension'` for a later browser extension.
- Game stats: play and win streaks, solve rate, average, best, the distribution (today's bar
  highlighted), a 6-month calendar and history.

**PWA**

- Manifest and icons, including maskable.
- A hand-written service worker: it shows an offline page when the network is down, caches build
  assets, and never caches pages or API responses.
- An install section in Settings, with iOS instructions.

**Ops**

- `/api/health` for the web app and `/health` for the worker.
- Scripts: `pnpm seed:demo`, `pnpm probe:embeds` plus a weekly GitHub Action, and the key
  generators.
- [DEPLOY.md](DEPLOY.md) and a README covering local setup.

## Screenshots index

Every branch's captures are in `docs/screenshots/<branch>/`. Each folder has a README listing
what was checked and what was fixed. Captures cover phone (390×844), tablet (768×1024) and
desktop (1440×900), in light and dark.

| Branch                                                      | Captures | Screens                                                                     |
| ----------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| [feat-design-tokens](screenshots/feat-design-tokens/)       | 18       | styleguide, dialog, toasts                                                  |
| [feat-game-registry](screenshots/feat-game-registry/)       | 6        | icon sheet                                                                  |
| [feat-passkey-signup](screenshots/feat-passkey-signup/)     | 54       | landing, every sign-up step and its errors                                  |
| [feat-passkey-login](screenshots/feat-passkey-login/)       | 30       | sign-in, recovery, add passkey                                              |
| [feat-device-pairing](screenshots/feat-device-pairing/)     | 30       | QR, approve, wrong number, declined                                         |
| [feat-passkey-settings](screenshots/feat-passkey-settings/) | 24       | settings, new phrase, last passkey, delete                                  |
| [feat-game-catalog](screenshots/feat-game-catalog/)         | 78       | catalog states, game pages, report, suggest, moderation                     |
| [feat-dashboard](screenshots/feat-dashboard/)               | 30       | empty, in progress, all done, at risk, reorder                              |
| [feat-result-logging](screenshots/feat-result-logging/)     | 48       | paste preview and error, manual, check-off, saved, popup blocked, log sheet |
| [feat-game-stats](screenshots/feat-game-stats/)             | 18       | long history, timed game, check-off game                                    |
| [feat-pwa-shell](screenshots/feat-pwa-shell/)               | 18       | offline page, install prompt, iOS instructions                              |

Visual-regression baselines (checked in CI): styleguide, catalog, game page and dashboard, each
in light and dark.

## Test summary

| Suite                         | Count                                   | What it covers                                                                                                                                                                                                                                                                                         |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit and integration (Vitest) | **335** (shared 211, web 93, worker 31) | parsers with real, malformed, tampered and future samples; puzzle math across timezones and DST; streaks, stats and heatmap; catalog rules and search; frame-header analysis; health state machine (plus DB tests); seed; tokens and contrast; SSRF guard; realtime room auth; web push                |
| End to end (Playwright)       | **101**                                 | sign-up, sign-in, recovery and lockout, pairing with two browsers, settings and IDOR, catalog, moderation, dashboard, logging, play flow and popup blocking, iframe sandbox and fallback, stats, PWA offline, health. Uses a virtual authenticator, and runs axe on every new screen in light and dark |
| Visual regression             | 8 baselines                             | rendered in the pinned image                                                                                                                                                                                                                                                                           |

CI is green on `main` for every merge in this phase except one. The `feat/dashboard` merge
failed on a flaky catalog test (a debounce race in the test itself). That was diagnosed and
fixed in `feat/game-stats`, together with a flaky pairing locator, and `main` has been green
since. (Runs for merges pushed in quick succession are cancelled in favour of the newest one.) Two of my own merges also briefly broke `main`: a lint error early on, and
`feat/passkey-settings`, where login specs still expected a sign-out button that had moved.
Both were fixed in follow-up branches.

## Embed probe results

Full report: [embed-probe/report.md](embed-probe/report.md) (JSON alongside). It probed all 70
games from the production origin's point of view.

- **70 / 70 reachable.**
- **32 block framing in their headers.** That includes all NYT games (`X-Frame-Options: DENY`),
  the LinkedIn games and Guardian (`frame-ancestors` limited to their own sites), Waffle, Bandle
  and Contexto.
- **4 load but can't stay framed.** Nerdle and Mini Nerdle break out of frames. Octordle and
  Quordle never finished loading within the time limit.
- **34 frame technically.** Examples: Globle, Worldle, Flagle, Travle, Minute Cryptic, Murdle,
  Squaredle, Semantle and Framed.

Every game still ships as `popout`. The spec requires iframe games to be "verified embeddable
**and permitted**". The probe shows a game _can_ be framed, not that the publisher _allows_
it, so switching any of the 34 is a manual step after checking each publisher's terms (see
[embed-probe/README.md](embed-probe/README.md)). The weekly workflow re-runs the probe and fails
if a game marked `iframe` stops passing.

## Known gaps

- **Optional email (3.6) is not built.** The schema has `email_tokens`; no magic link or Resend
  integration yet. It was optional and not in the Phase 1 branch plan; it fits naturally with
  Phase 2's email reminders.
- **No Lighthouse or bundle budget in CI** (6E). `@lhci/cli` is approved but not wired up.
- **Keyboard-only walkthrough is not a dedicated test.** Specs drive everything through roles
  and labels, and axe runs everywhere, but no single test tabs through a full journey.
- **Visual baselines cover four screens.** Auth screens rely on the review captures and
  functional tests.
- **Charts are HTML/CSS, not Recharts.** They're accessible and add no bundle weight; Recharts
  can still come in later for trend lines.
- **Worker health check verified against local Postgres only.** I ran it under `wrangler dev`
  through the Hyperdrive binding and it wrote 70 checks. Real outbound requests couldn't be
  tested from this sandbox, where workerd has no DNS; the first production cron run is the real
  test. The weekly header re-probe from PLAN.md is folded into the daily check, which reads the
  same headers.
- **Hyperdrive id is a placeholder** in `wrangler.toml` until you create it (DEPLOY.md step 4).
- **Not started yet, by design:** realtime UI (Phase 3), reminders and push (Phase 2), and native
  games (Phase 4). The realtime token route and the worker rooms from the spike are in place.
- **Promoting a Tier 3 game to Tier 2/1 needs a parser in code.** The editor enforces this, but
  there's no UI to add share-text samples to a database-only game.
- **Combined streak edge case.** It counts days by each puzzle's date, so a puzzle released the
  evening before (the Mini) counts toward the next day.
