# Phase 6 report

Status: the browser extension and the gaps found in a line-by-line audit of the brief are built
and merged to `main`, the dark theme is a deep purple with a visible three-way switch, and there
is a platform stats page for the admin. See `docs/spec-audit.md` for the full checklist.

**Deploying:** three migrations (0014 capture tokens, 0015 notifications; 0013 came earlier) run
with the usual step. New optional settings: `ERROR_WEBHOOK_URL`, `LOG_REQUESTS` (see DEPLOY.md).
Sign-in by email appears automatically once email is set up. Make yourself admin with
`pnpm user:role <username> admin`; only you then see **Admin → Platform stats**.

## What shipped

- **Dark theme.** A deep purple with layered violet surfaces (the old near-black didn't read as
  purple). The theme button is now three visible choices (Match device, Light, Dark) with the
  current one marked, in the header and in Settings. Tests check the real page colour for each
  choice, the browser chrome colour and the dark stat cards.
- **Browser extension** (`apps/extension`, Chromium MV3). It sees what a game copies when you
  press Share, ignores anything that doesn't look like a result, and posts it with a token that can
  only add results. The server finds the game from the text and the page address and saves it as a
  paste would (source `extension`); repeats are refused, never overwritten. Tokens are made and
  removed in Settings, shown once, stored only as a hash, limited to ten, and rate limited per
  address on wrong guesses. The site list is built from the catalog. Tested in real Chromium with
  the built extension.
- **Email sign-in links** for accounts with a confirmed address. The reply never reveals whether
  an address has an account; links work once for 15 minutes; only the newest works; signing in
  takes a tap so mail scanners can't use a link up.
- **Look and feel settings:** reduce motion, sound effects (off by default) and vibration, saved on
  the account and applied across devices.
- **Notifications inbox** with a bell and unread count: friend requests and acceptances, replies,
  decisions on solutions, moderator removals.
- **Rankings page:** combined points this week, "played here" (server-verified native results) and
  "all games" (self-reported, labelled). Hidden players are left out.
- **Platform stats (admin only):** online now, active over 24 hours, 7 and 30 days, sign-ups,
  results by source, per-game players, followers and solve rate, community activity and busiest
  boards, and a 14-day table. Totals only; moderators get a 404.
- **Observability:** one JSON log line per notable API request with a request id (also returned in
  `X-Request-Id`), secrets redacted, an optional error webhook.
- **Quality:** size budgets checked in CI, a keyboard-only walkthrough, speed guards, a share-text
  checker for moderators, and visual baselines for sign in, community, notifications and settings.

## Not built

Lighthouse (needs a new dependency; the speed guards cover the same ground coarsely). See the
known gaps in `docs/spec-audit.md`.

## Screenshots index

| Folder                                                        | Screens                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| [feat-deep-purple-theme](screenshots/feat-deep-purple-theme/) | the purple theme and the theme switch                                 |
| [feat-phase6](screenshots/feat-phase6/)                       | platform stats, rankings, notifications, look and feel, email sign-in |

## Test summary

| Suite                         | Count                                                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit and integration (Vitest) | see CI; new: capture routing, extension helpers, rankings, log redaction                                                                                   |
| End to end (Playwright)       | the full run passes with the worker; new specs: extension (API and real Chromium), email sign-in, notifications, rankings, platform stats, keyboard, speed |
| Visual regression             | baselines regenerated for the purple theme, the header bell and the new screens                                                                            |

A late CI catch worth knowing: the new theme switch is a button group, which broke one older
pairing test that read every button in any group as a number. The test now picks only the number
buttons.
