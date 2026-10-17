# EveryDaily — Project Plan

Status: **approved**; decisions recorded in section 18.

---

## 0. Constraints to keep in mind

1. **Passkeys are permanently bound to the WebAuthn RP ID (a domain).** If users register
   passkeys on `everydaily.raycode.tech` and the product later moves to `everydaily.com`, every
   existing passkey stops working there. Related Origin Requests can bridge this, but browser
   support is incomplete. Recovery phrases and email would still let people back in. Either way,
   choose the production host before any real user signs up.
2. **Renaming is one constant for copy only.** `packages/shared/src/brand.ts` holds the name,
   tagline and colors. The domain, RP ID, cookie names and push VAPID subject come from env, so a
   rename does not touch them. That is intentional, because changing the RP ID breaks passkeys.
3. **Scope.** Phase 1 as specified is a large build: full passkey auth with recovery and pairing,
   a 60+ game catalog, 9 parsers, stats, PWA, embed probe and the full test and screenshot
   protocol. I will deliver it as about 12 reviewable branches (section 16), not one drop.

---

## 1. Architecture

```
                 ┌──────────────────────────── Browser / PWA ────────────────────────────┐
                 │  Next.js UI · service worker (offline shell, push) · WebAuthn client  │
                 └───────┬──────────────────────────────┬──────────────────────┬────────┘
                         │ HTTPS (cookies, CSRF)        │ WSS (signed token)   │ popout / iframe
                         ▼                              ▼                      ▼
     ┌──────────────── Vercel ─────────────────┐  ┌──── Cloudflare ─────────────────┐   third-party
     │ apps/web  Next.js App Router (Node rt)  │  │ apps/worker                     │   game sites
     │  · pages, route handlers, server actions│  │  · fetch: /rt/:room  → DO       │   (never read)
     │  · auth (SimpleWebAuthn), sessions      │  │  · fetch: /internal/broadcast   │
     │  · result logging + parsers             │──┼─▶  (HMAC-signed, from web)      │
     │  · mints realtime tokens (Ed25519)      │  │  · DO RoomDO (Hibernation API)  │
     │  · next/og stat cards                   │  │  · cron: reminders, health,     │
     └──────┬───────────────────┬──────────────┘  │    embed header re-probe        │
            │ postgres.js        │ HTTP             │  · Queue consumer: web push     │
            ▼ (Neon pooler)      ▼                  └──────┬──────────────┬──────────┘
     ┌──────────────┐   ┌────────────────┐                │ Hyperdrive   │ HTTP
     │ Neon Postgres│◀──│ Upstash Redis  │◀───────────────┘ (postgres.js)┘
     └──────────────┘   └────────────────┘
     packages/shared: Drizzle schema · zod · game registry (YAML) · parsers · puzzle math · brand
```

Writes go over HTTP and reads stream over the socket. Every persistent write (posts, comments,
results, votes) goes through Next.js route handlers, which own validation, authorization, rate
limits and moderation. After committing, the web app POSTs a signed event to the worker, and the
Durable Object broadcasts it. Only ephemeral events (typing, presence) go from the client
straight to the DO. This keeps a single write path and a single place to audit.

### DECISION: worker DB connection is **Hyperdrive + postgres.js**, not the Neon serverless driver

- **One driver everywhere.** The web app uses postgres.js against the Neon pooled connection
  string, the worker uses postgres.js through Hyperdrive, and local dev uses postgres.js against
  plain local Postgres. The same Drizzle dialect (`drizzle-orm/postgres-js`) runs in all three.
- **Local dev just works.** `wrangler dev` points Hyperdrive at the local Postgres with
  `localConnectionString`. The Neon HTTP driver against local Postgres needs an extra proxy
  container.
- **Cron fan-out does many small queries.** Hyperdrive pools connections at the edge and keeps
  per-query latency low [Likely]. The Neon HTTP driver pays one HTTP round trip per query.
- **Cost:** one more Cloudflare resource to configure (a Hyperdrive config ID per environment).

---

## 2. Domains and deployment (raycode.tech)

Proposal. All hosts come from env, so we can change them until launch:

| Host                          | Serves                                | Where                          |
|-------------------------------|---------------------------------------|--------------------------------|
| `everydaily.raycode.tech`     | Next.js app (WebAuthn RP ID = this host) | Vercel (CNAME, DNS-only)    |
| `rt.everydaily.raycode.tech`  | Worker: WebSockets + internal broadcast | Cloudflare Workers custom domain |
| Preview: `*.vercel.app`       | Preview deploys (RP ID = preview host, so passkeys there are throwaway) | Vercel |

- Workers custom domains require the `raycode.tech` zone to be on Cloudflare DNS
  [Certain]. The Vercel record should be a grey-cloud (DNS-only) CNAME.
- The RP ID should be the **exact app host**, not `raycode.tech`. An apex RP ID would let any
  other site you host on a raycode.tech subdomain request assertions for these credentials.
- Realtime auth uses a token, not cookies, so cross-subdomain cookie scope does not matter.

---

## 3. Repo layout

```
apps/web/            Next.js App Router
  src/app/           routes (section 5)
  src/components/    design system (ui/ = restyled shadcn primitives; game/ = tiles, rings, flames)
  src/server/        auth, rate limit, csrf, db access, services (no React)
  src/styles/        tokens.css (single source of design tokens), globals.css
  public/            manifest, icons, sw.js (built)
  e2e/               Playwright specs + visual baselines
apps/worker/
  src/index.ts       fetch router, scheduled(), queue()
  src/room.ts        RoomDO (Hibernation API)
  src/jobs/          reminders.ts, health.ts, embed-reprobe.ts, push.ts
  wrangler.toml
packages/shared/
  src/brand.ts       BRAND constant (name, tagline, colors) — the one-line rename
  src/db/            Drizzle schema + migrations
  src/validators/    zod schemas shared by web + worker
  src/registry/      YAML loader + zod GameSpec schema
  src/parsers/       one file per parser + index.ts registry + __fixtures__/
  src/time/          puzzle-number + reset math, streak engine
  games/*.yaml       catalog source of truth
scripts/
  probe-embeds.ts    section 9
  seed.ts            games + demo users/results
  check-history.sh   the git-history guard from the brief
docs/
  screenshots/<branch>/
  embed-probe/       report.json + report.md
```

---

## 4. Data model (Drizzle, Postgres)

IDs are `uuid` v7 (time-ordered). All timestamps are `timestamptz`. `citext` is used for
usernames. Only the important columns are listed.

**Identity and auth**
- `users` — id, username (citext, unique), display_name, email (citext, nullable, unique),
  email_verified_at, timezone (IANA), quiet_hours_start/end (local time), spoiler_safe (bool),
  prefs (jsonb: sound, haptics, reduced_motion override), created_at, deleted_at
- `passkey_credentials` — id, user_id, credential_id (bytea, unique), public_key (bytea),
  counter (bigint), transports (text[]), device_type, backed_up (bool), nickname, aaguid,
  created_at, last_used_at
- `recovery_phrase_hashes` — user_id (PK), hash (argon2id string), created_at. Regenerating the
  phrase replaces the row.
- `auth_challenges` — **in Redis, not Postgres**: `chal:{id}` → {challenge, purpose, userId?},
  TTL 120s, deleted on read (GETDEL) so each challenge is single-use.
- `device_pairings` — id, code_hash, initiator_fingerprint, number_match (2-digit),
  status (pending|approved|denied|consumed|expired), approved_by_user_id, expires_at (2 min),
  created_at
- `sessions` — id (random 256-bit, stored as sha256 hash), user_id, created_at, last_seen_at,
  expires_at, revoked_at, user_agent, ip_hash. Cookie = raw token.
- `email_tokens` — hash, user_id, purpose (verify|login), expires_at, used_at
- `auth_attempts` — Redis counters, not a table

**Catalog**
- `games` — id, slug (unique), name, category, difficulty, tier (1|2|3),
  embed_mode (iframe|popout|native), url, reset_mode (fixed|user_local), reset_tz, reset_hour,
  puzzle_epoch (date), epoch_number (int, the number on the epoch date), parser_id,
  scoring_type (attempts|time|points|completion|distance), status (active|possibly_down|archived),
  verified_embeddable_at, accent_color, icon_key, attribution_note, source_yaml_hash, updated_at
- `game_submissions` — id, submitted_by, url, normalized_key (unique among open submissions),
  name, category, reset_hint, sample_share_text, fetched_title, fetched_description,
  probe_result (jsonb), status (pending|approved|rejected|duplicate), reviewed_by, reviewed_at
- `game_reports` — id, game_id, user_id, kind (wrong_reset|moved|dead|other), details, status
- `game_health_checks` — id, game_id, checked_at, http_status, ok, consecutive_failures,
  x_frame_options, csp_frame_ancestors

**Play and stats**
- `follows` — (user_id, game_id) PK, position (for dashboard ordering), created_at
- `results` — id, user_id, game_id, puzzle_number (int), puzzle_date (date, derived),
  score (numeric, meaning depends on scoring_type), attempts (int), max_attempts,
  time_seconds, solved (bool), details (jsonb: per-board scores, emoji grid),
  raw_share_text (text, ≤ 4 KB), source (paste|manual|checkbox|native|extension),
  created_at. **UNIQUE (user_id, game_id, puzzle_number).**
- `streaks` — (user_id, game_id) PK, current, best, last_puzzle_number, updated_at.
  A cache recomputed from `results` and `streak_freezes`, never the source of truth.
- `streak_freezes` — id, user_id, game_id?, puzzle_number_used?, granted_at, used_at
- `notes` — id, user_id, game_id, puzzle_number?, body_md, created_at (private by default)
- `solutions` — id, game_id, puzzle_number, puzzle_date, body_md, source_url (required),
  submitted_by, status (pending|approved|rejected|removed), reviewed_by

**Reminders and notifications**
- `reminders` — id, user_id, game_id?, local_time (time), timezone, channel (push|email),
  kind (daily|streak_at_risk), enabled
- `reminder_deliveries` — (reminder_id, local_date) PK. The dedupe guard that prevents double
  sends.
- `push_subscriptions` — id, user_id, endpoint (unique), p256dh, auth, user_agent, created_at,
  last_success_at, failure_count
- `notifications` — id, user_id, kind, payload (jsonb), read_at, created_at

**Social (Phase 3)**
- `friendships` — (user_a, user_b) with user_a < user_b, status (pending|accepted|blocked),
  requested_by
- `groups`, `group_members` (role: owner|admin|member), `communities` (slug, game_id?, rules_md),
  `community_members`, `flairs`
- `posts` — id, community_id, author_id, title, body_md, flair_id, is_daily_thread,
  puzzle_number?, spoiler (bool), score, comment_count, status (visible|removed|locked)
- `comments` — id, post_id, parent_id, author_id, body_md, depth, path (ltree or
  materialized-path text), spoiler, score, status
- `votes` — (user_id, target_type, target_id) PK, value (−1|1)
- `reports` — id, reporter_id, target_type, target_id, reason, status
- `mod_actions` — id, actor_id, action, target_type, target_id, reason, before (jsonb),
  after (jsonb), created_at. Append-only; the DB role has no UPDATE or DELETE on it.
- `badges`, `user_badges`

### Puzzle identity

Every game, Tier 3 included, has a **day index**:
`puzzle_number = epoch_number + days(epoch, current_puzzle_date)`.

- `reset_mode = user_local`: the puzzle date is the user's local date, shifted by `reset_hour`.
  The NYT games work this way; Wordle changes at each player's local midnight [Likely].
- `reset_mode = fixed`: the date in `reset_tz` after `reset_hour`.
- Games with no public numbering still get our own index from an arbitrary epoch, so the unique
  key and streak math are uniform.
- **Streaks count consecutive puzzle numbers, not calendar days.** That makes them immune to
  travel and DST. "Today" only matters for the checklist and reminders.
- **Future-dated check:** reject `puzzle_number` greater than the number currently live in
  UTC+14, the earliest timezone. This allows travellers and blocks real future puzzles. Also
  reject anything before the epoch.

---

## 5. Route map

**Pages (apps/web)**
| Route | Purpose |
|---|---|
| `/` | Landing (signed out); redirects to `/today` when signed in |
| `/start` | Signup wizard: username → puzzle gate → passkey → recovery phrase → confirm 2 words |
| `/login` | Conditional UI passkey autofill + button; links to recovery and pairing |
| `/login/recover` | Username + phrase |
| `/login/pair` | New device: shows QR + 2-digit number |
| `/pair/[code]` | Logged-in device: approve the pairing after number match |
| `/today` | **Dashboard hero**: today's checklist, progress ring, combined streak, one-tap play |
| `/games` | Catalog: search, category chips, difficulty, tier, embed filter |
| `/games/[slug]` | Game page: play, log result, streak, distribution, averages, heatmap, history, report |
| `/games/[slug]/play` | iframe host (only for verified iframe games) or native game |
| `/games/suggest` | Suggestion form (feature flag) |
| `/settings` | Profile, timezone, passkeys (add/rename/revoke), recovery phrase regen, email, sessions, export, delete |
| `/admin/*` | Mod queue, game editor, tier promotion, submissions, audit log |
| `/offline` | PWA offline shell |
| P2+: `/games/[slug]/solutions`, `/archive`, `/friends`, `/groups/[id]`, `/c/[slug]`, `/c/[slug]/[postId]`, `/wrapped/[period]` |

**API (route handlers, all mutations require session + CSRF unless noted)**
```
POST /api/auth/username/check          (public, rate-limited)  { username } → { ok, reason?, suggestion? }
POST /api/auth/username/suggest        (public)
POST /api/auth/pow/challenge           (public)  → { id, salt, difficulty }
POST /api/auth/signup/begin            (public)  { username, powSolution, gateToken, turnstile? } → registration options
POST /api/auth/signup/finish           (public)  { attestation } → session + recovery phrase (one time)
POST /api/auth/recovery/confirm        { words: [{index, word}] }
POST /api/auth/login/options           (public)  → authentication options (discoverable, no allowCredentials)
POST /api/auth/login/verify            (public)
POST /api/auth/recover                 (public)  { username, phrase }
POST /api/auth/pair/start              (public)  → { code, qrUrl, number }
GET  /api/auth/pair/status?code=       (public, polling, short)
POST /api/auth/pair/approve            { code, number }
POST /api/auth/logout
GET/POST/PATCH/DELETE /api/me/passkeys[/:id]
POST /api/me/recovery/regenerate
GET  /api/me/export      DELETE /api/me
GET  /api/games          GET /api/games/:slug
POST/DELETE /api/follows/:gameId      PATCH /api/follows/order
POST /api/results        { gameId, shareText? | manual{...}, source }   → parsed preview or saved
POST /api/results/preview                                                → parse only, no write
DELETE /api/results/:id
GET  /api/stats/:gameSlug
POST /api/games/:slug/report
POST /api/submissions                    (flag)
POST /api/realtime/token                 → { token, url, expiresIn: 60 }
GET  /api/health
```
The results API accepts a `source` field and an optional `client` header so a future browser
extension can post the same payload with its own source value (`extension`).

**Worker**
```
GET  /rt/:roomType/:roomId     WebSocket upgrade (token in Sec-WebSocket-Protocol)
POST /internal/broadcast       HMAC-signed by web app; body { room, event }
GET  /health
scheduled(): */5 * * * *  reminders + streak-at-risk
             17 4 * * *   game URL health check
             23 5 * * 1   weekly embed header re-probe
queue(): push-send consumer
```

---

## 6. Auth state machine

```
SIGNUP
 [anon] ─username ok─▶ [username_reserved (Redis, 10 min, keyed to device cookie)]
   ─gate solved + PoW verified + rate limits ok (+Turnstile if flag)─▶ [gate_passed: signed gateToken, 5 min]
   ─/signup/begin─▶ [challenge_issued (Redis TTL 120s)]
   ─/signup/finish verified─▶ TX { insert user, credential, recovery hash } ─▶ [session_active, recovery_unconfirmed]
   ─confirm 2 words─▶ [active]
   (recovery_unconfirmed: app works, but a persistent banner blocks dismissal until confirmed;
    phrase is re-shown ONLY within the same session until confirmed, then never again)

LOGIN
 [anon] ─options─▶ [challenge_issued] ─assertion ok, counter check─▶ rotate session ─▶ [active]
 [anon] ─username+phrase─▶ argon2id verify (constant work even for unknown usernames)
        ok  ─▶ [active, prompt: "add a passkey on this device"]
        bad ─▶ backoff: 5 fails → 1 min, then ×2 up to 24 h, per username AND per IP
 [new device] ─pair/start─▶ [pending] ─approve on signed-in device with matching number─▶
        [approved] ─new device polls, consumes once─▶ session ─▶ prompt to create passkey
        any state ─2 min─▶ [expired]

SESSION
 cookie __Host-ed_session (httpOnly, Secure, SameSite=Lax, Path=/), 30-day sliding, rotated on
 login/privilege change, revocable per row. CSRF: double-submit token in __Host-ed_csrf +
 X-CSRF-Token header, plus Origin header check on every non-GET.
```

- WebAuthn options: `userVerification: "required"`, `residentKey: "required"`, no
  `authenticatorAttachment`, `attestation: "none"`, algs [-8, -7, -257]. `expectedOrigin` and
  `expectedRPID` come strictly from env.
- UI copy: "Your device decides how to confirm it's you: Face ID, fingerprint, Windows Hello or
  your device PIN. We never see any of it."
- **Bot protection layers:**
  1. Puzzle gate (fun only).
  2. SHA-256 hashcash PoW, server-issued and single-use, about 0.5–1.5 s on a phone.
  3. Upstash sliding-window limits per IP, per device cookie and per username.
  4. Turnstile behind `FEATURE_TURNSTILE`.
  5. Signup/begin requires the gateToken **and** the PoW. Tests prove that bypassing the puzzle
     UI still hits layers 2–4.
- Recovery phrase: 6 words from the BIP39 English list (2048 words, 66 bits), generated with
  `crypto.getRandomValues`, stored as argon2id (m=64 MiB, t=3, p=1 [Likely sane for Vercel
  Node; tune in tests]).
- Usernames: 3–20 chars, `[a-z0-9_]`, no leading or trailing underscore, NFKC-normalized,
  checked against a reserved list (admin, mod, api, support, brand name…) and a profanity list
  that also catches leetspeak. Uniqueness is enforced by the DB constraint, and the race test
  inserts concurrently.

---

## 7. Parser interface

```ts
// packages/shared/src/parsers/types.ts
export interface ParseContext {
  game: GameSpec;            // reset rule, epoch, scoring type
  nowUtc: Date;
  userTimeZone: string;
}
export type ParseResult =
  | { ok: true; value: {
      puzzleNumber: number; puzzleDate: string;      // date derived from number
      solved: boolean; attempts?: number; maxAttempts?: number;
      timeSeconds?: number; score?: number;
      details?: Record<string, unknown>;              // per-board, emoji grid, hints used…
      normalizedShareText: string; } }
  | { ok: false; code: 'not_this_game'|'malformed'|'future_puzzle'|'before_epoch'
                       |'inconsistent'|'too_long'; message: string };

export interface Parser {
  id: string;                         // matches games/*.yaml parserId
  detect(text: string): boolean;      // cheap header check, used for auto-routing pasted text
  parse(text: string, ctx: ParseContext): ParseResult;
}
```

- `parsers/index.ts` is a `Record<string, Parser>`. Adding a parser means one file plus one
  line there. A CI test asserts that every `parserId` in the YAML resolves and that every YAML
  `shareTextSamples[]` entry parses.
- Tamper checks (`inconsistent`):
  - the emoji grid row count must match the attempts count
  - Quordle/Octordle per-board numbers must match the number of boards
  - Connections needs exactly 4 tiles per row
  - times must fall within plausible bounds
- Tier 2 `generic` parser: puzzle number via `#?\d{1,5}`, score via `(\d+|X)/(\d+)`, plus
  emoji-grid capture. It returns partial values, and the UI asks for the rest.
- Every parser is NFKC-normalized and strips zero-width characters before matching. Input is
  capped at 4 KB.
- Phase 1 parsers: wordle, connections, strands, nyt-mini (time), nyt-crossword (time), quordle,
  octordle, globle, worldle, minute-cryptic, generic.
- **Fixture caveat:** I cannot fetch live share strings from this environment (section 18). I
  will write fixtures from the share formats as I know them [Likely accurate, not verified
  live]. You should paste a few real strings for each game so I can confirm the formats.

---

## 8. Catalog pipeline

- `games/<slug>.yaml` is validated by `GameSpecSchema` (zod) in CI. `pnpm seed:games` upserts
  by slug and stores `source_yaml_hash`, so DB edits made by admins are detected rather than
  silently overwritten. The YAML wins only when its hash changed, and any conflict is logged.
- Tier 3 needs zero code: follow, reminders, a "done today" checkbox that writes a
  `results` row with `source=checkbox`, and streaks.
- **Icons:** original SVG glyphs. A small hand-drawn set of about 30 motifs (globe, grid, flag,
  note, clock, spiral…) is combined with a per-game accent color and a shape frame, using
  deterministic defaults plus per-game overrides in YAML. Simple geometric icons, not
  illustrations. No third-party marks.
- Each game page carries this attribution: "Made by <publisher>. EveryDaily isn't affiliated
  with <publisher>; we just help you keep track."
- **Submissions** (behind `FEATURE_SUBMISSIONS`, admin-only at launch):
  1. Normalize the URL (lowercase host, strip `www.`, trailing slash, query and hash).
  2. Dedupe on that normalized key.
  3. Fetch only `<title>` and the meta description (5 s timeout, 256 KB cap, SSRF guard that
     blocks private, loopback and link-local IPs after DNS resolution).
  4. Run the header probe.
  5. Queue for moderator review.
- Health: daily worker check (HEAD, then GET on 405). Three consecutive failures set
  `possibly_down`. Moderators archive. A state-transition function is unit-tested.
- 60+ seed list: I will draft it from my knowledge, but **I cannot verify URLs from this
  container**. Each YAML gets `verifiedLiveAt: null` until a probe run from a network that
  reaches the sites confirms it, and the seed script marks unverified games `possibly_down`.
  See section 18.

---

## 9. Play flow and embed probe

- `embedMode` defaults to `popout`. `iframe` is allowed only when `verifiedEmbeddableAt` is set
  by a passing probe. CI fails if a YAML says iframe without a probe record.
- **Popout:**
  - Opened only in the click handler with `window.open(url, 'ed-play', 'popup,width=480,height=860')`.
  - On desktop the window sits beside the app, and our page shows the docked "Log my result"
    panel. On mobile it opens a new tab, and on return (visibilitychange/focus) the log sheet
    pops up.
  - If `window.open` returns null, the app shows designed fallback copy with a plain link.
- **Iframe:**
  - `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`,
    `referrerpolicy="no-referrer"`, `allow=""`.
  - Shows a loading tile and an 8 s watchdog. Since we cannot read cross-origin state, a
    blocked frame is inferred from the load event never firing or the probe status. The page
    then degrades to popout with: "This game doesn't allow being shown inside other sites.
    Opening it in its own window."
- **`scripts/probe-embeds.ts`:**
  1. Server-side GET to read X-Frame-Options and CSP `frame-ancestors`.
  2. Playwright loads a local harness page that iframes the URL, then watches for
     console/pageerror "Refused to display", the frame's response status, frame URL
     `chrome-error://`, a blank document and a 10 s timeout.
  3. Writes `docs/embed-probe/report.{json,md}` with a proposed mode and a diff against the
     current YAML.
- The worker re-runs only the header half weekly, since there is no browser in a Worker. The
  full Playwright probe runs as a scheduled GitHub Action. Cloudflare Browser Rendering would be
  an alternative, but it is a new paid product, so it is not used.

---

## 10. Realtime (Durable Objects)

- One `RoomDO` per room id `community:<id>`, `group:<id>` or `thread:<postId>`, created with
  `idFromName`.
- **Auth:**
  - `POST /api/realtime/token` checks membership and visibility, then mints a compact token
    signed with **Ed25519** by Web Crypto:
    `{sub, room, perms:['read','typing','presence'], exp: now+60s, jti}`.
  - The worker holds only the public key, so a worker compromise cannot mint tokens.
  - The browser sends it as `Sec-WebSocket-Protocol: ed.v1, auth.<token>`, which keeps it out
    of URL logs. The worker verifies `room` matches the path, checks `exp`, and rejects a reused
    `jti` (a DO-local set with TTL) before `ctx.acceptWebSocket(ws, [userId])`.
  - The attachment (`serializeAttachment`) stores {userId, username, expAt}.
- **Session expiry:** the socket stays open, but every ~10 min the client must send `reauth`
  with a fresh token. Otherwise the DO closes with 4401.
- **Protocol (JSON):**
  ```
  S→C hello     {seq, presence:[...], since?}
  S→C event     {seq, kind:'comment.created'|'comment.removed'|'leaderboard.updated'|'post.updated', data}
  S→C presence  {joined?|left?, userId}
  S→C typing    {userId, until}
  C→S typing    {}                       (throttled 1/3s client, enforced in DO)
  C→S resume    {since: seq}             → replays from ring buffer (last 200 events in DO storage)
                                           or {kind:'resync'} if too old → client refetches over HTTP
  C→S reauth    {token}
  C→S ping      {}  → auto-response via setWebSocketAutoResponse (no wake)
  ```
- Ordering: the DO assigns a monotonic `seq` per room, persisted in DO storage, so events are
  totally ordered within a room. Clients dedupe by seq.
- Isolation: every DO serves exactly one room. The token's `room` must equal the DO name.
- Reconnect: exponential backoff with full jitter (0.5 s → 30 s cap), then `resume`.
- Hibernation: no in-memory state is assumed after wake. Presence is rebuilt from
  `ctx.getWebSockets()` attachments.

---

## 11. Worker jobs

- **Reminders (every 5 min):**
  1. Select enabled reminders whose `local_time` falls in the window [now−5 min, now) in their
     timezone. This is computed in SQL with `AT TIME ZONE`, so DST is handled by Postgres.
  2. Skip users in quiet hours, users who already logged the current puzzle, and rows that
     already have a `reminder_deliveries` entry. The insert uses ON CONFLICT DO NOTHING, which
     guarantees the dedupe.
  3. Send to `push-queue` in batches of 100.
- **Streak at risk:** for users with `current ≥ 3` and no result for the current puzzle, send
  one nudge 2 h before that game's next reset in their timezone, unless it falls in quiet
  hours.
- **Push consumer:** VAPID-signed, aes128gcm-encrypted payload. A 404 or 410 response deletes
  the subscription. 429 and 5xx responses retry with queue backoff (max 3).
- **Health and re-probe:** as described in sections 8 and 9. Status changes create a
  `game_reports` row of kind `auto` for moderators.
- **Web push library:** decided by the spike. Candidates are `@block65/webcrypto-web-push`
  [Likely Workers-compatible] or about 200 lines of our own RFC 8291/8292 implementation on Web
  Crypto (no dependency). The spike sends a real notification to Chromium through the push
  service and decrypts in a test.

---

## 12. Design tokens

Single source: `apps/web/src/styles/tokens.css` (CSS custom properties) mapped into the Tailwind
theme. Per-game accents are in YAML.

- **Color (light / dark):**
  - paper `#FFF7EA` / ink-950 `#14122B`
  - ink `#1D1A3A` / `#F5F1FF`
  - primary "Pop" `#FF5B2E`, secondary "Grape" `#7A4DFF`, "Mint" `#1FC98E`, "Sun" `#FFC531`,
    "Sky" `#2FA8FF`
  - semantic success, warn, danger, info
  - every accent has a paired `-ink` text color that meets ≥ 4.5:1, checked by a unit test
- **Type:** display is **Fredoka** (rounded, 600–700), body/UI is **Nunito** (rounded, legible
  at 14px), numbers use Nunito tabular figures. Both are self-hosted via `next/font` (Google, no
  runtime requests). The scale is 12/14/16/18/22/28/36/48/64.
- **Radius:** 8 / 12 / 18 / 28 / pill. **Border:** 2–3px ink outlines on game surfaces.
- **Elevation is "chunky":** `--lift-1: 0 3px 0 var(--edge)` and `--lift-2: 0 6px 0 var(--edge)`.
  Pressed state uses `translateY(var(--lift))` with no shadow. There are soft shadows only for
  overlays.
- **Motion:** 90 / 160 / 260 / 420 ms; spring presets `snap` (stiffness 600, damping 30) and
  `bouncy` (400/15). Animations include the tile flip, streak-flame flicker, confetti and ring
  fill. All of them collapse to opacity fades under `prefers-reduced-motion` or the user
  setting.
- **Components v1:** Button (primary, secondary, ghost, danger; sizes; pressed/loading/disabled),
  Tile/Card, GameIcon, Chip, Input, OTP-like word inputs, Sheet/Dialog, Toast, ProgressRing,
  StreakFlame, EmptyState, Skeleton, Tabs, Switch, Tooltip, Heatmap, DistributionBars.
- Sound and haptics are opt-in (`navigator.vibrate`, Web Audio blips we generate, no samples).

---

## 13. Security and quality

- zod on every handler input. Drizzle parameterizes everything, and raw SQL uses only the `sql`
  template.
- **Markdown:** a strict subset (bold, italic, code, links, lists, quote, spoiler `>!…!<`).
  Raw HTML is off and the output goes through an allowlist sanitizer. Links get
  `rel="nofollow ugc noopener"` and only http/https schemes.
- Rate limits (Upstash sliding window) apply to auth, posting, reporting, submissions, results
  and token minting.
- **Authorization:** each service function takes an `actor` and checks ownership or membership.
  An IDOR test suite hits every `:id` route as a different user.
- Response headers: strict CSP (nonce-based scripts), `frame-ancestors 'none'` for our own
  pages, HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, a Permissions-Policy that
  allows only what we use.
- Privacy: `/api/me/export` returns a JSON zip. Delete is a soft delete followed by a hard purge
  after 7 days in a worker cron. IPs are stored only as salted hashes.
- Observability: JSON logs (`level, msg, reqId, userId?`), an `onError` hook interface (Sentry
  can plug in later and is not added now), and `/api/health` plus worker `/health`, which check
  DB and Redis.

---

## 14. Local development

**Docker is not available in this build environment.** `docker-compose.yml` will still ship for
your machine, with Postgres 16, Redis, and `serverless-redis-http` so the Upstash REST client
works locally. In CI and here I run native `postgres` 16 and `redis-server` (both installed)
plus the SRH shim, or an in-process fake behind the same rate-limit interface. The worker runs
via `wrangler dev` with a Hyperdrive `localConnectionString`.

---

## 15. Testing plan

- **Unit (Vitest):**
  - all parsers: valid, malformed, duplicate, future, tampered, before epoch, wrong game
  - puzzle math across time zones and DST
  - streak engine, including freezes and backfill
  - reminder window SQL against real Postgres
  - health transitions, URL normalization and dedupe
  - username rules, PoW verify, CSRF, token sign/verify, contrast of tokens
- **Worker:** `@cloudflare/vitest-pool-workers` for RoomDO: connect, auth failure,
  expired/reused token, room isolation, ordering, resume, hibernation wake (via
  `runDurableObjectAlarm` / state reload).
- **E2E (Playwright):**
  - CDP virtual authenticator: signup, login, conditional UI, multi-passkey, revoke
  - recovery and lockout, the 2-word confirm
  - pairing with two browser contexts
  - username race
  - puzzle-gate bypass still blocked by PoW and rate limits
  - popout (popup event, blocked-popup fallback, focus return, mobile viewport)
  - iframe fallback, using a local fixture server that sends XFO DENY vs allowed
- **Visual:** screenshots at 390×844, 768×1024 and 1440×900, light and dark, for every
  new/changed screen and state, saved to `docs/screenshots/<branch>/`. I review them and
  iterate. Visual-regression baselines cover dashboard, catalog, game page and auth (community
  in P3).
- **Non-functional:** `@axe-core/playwright` on each key page, a keyboard-only walkthrough spec,
  reduced-motion snapshots, Lighthouse CI (budgets: LCP < 2.5 s on mid-tier mobile emulation,
  JS < 180 KB gzip on `/today`).
- **Security:** XSS payload corpus against every user-content renderer, CSRF negative tests,
  rate-limit tests, the IDOR suite.
- **Seed:** `pnpm seed:demo` creates demo users, follows and 90 days of results so screenshots
  show real data.
- **Gate per branch:** lint, typecheck, unit, e2e green; screenshots reviewed; the
  `scripts/check-history.sh` guard clean.

---

## 16. Phase 1 branch plan (in order)

1. `chore/monorepo-setup` — pnpm workspaces, TS configs, lint/format, Vitest, CI workflow,
   history guard
2. `feat/design-tokens` — tokens, fonts, core components, `/styleguide` page (dev only),
   screenshots
3. `feat/db-schema` — Drizzle schema for the Phase 1 tables, migrations, local DB scripts
4. `feat/game-registry` — GameSpec zod, YAML loader, puzzle math + tests, 60+ YAML files,
   original icon set, seed
5. `feat/share-parsers` — parser interface, 10 Tier 1 parsers + generic, fixtures and tests
6. `feat/passkey-signup` — username flow, puzzle gate, PoW, rate limits, registration,
   recovery phrase
7. `feat/passkey-login` — login, conditional UI, recovery login + lockout, sessions, CSRF
8. `feat/device-pairing` — QR + number match
9. `feat/passkey-settings` — manage passkeys, regenerate phrase, sessions list, export/delete
10. `feat/game-catalog` — catalog UI with search and filters, game detail shell, report a
    problem
11. `feat/dashboard` — follows, today's checklist, progress ring, combined streak
12. `feat/result-logging` — paste/parse/preview/save, manual fallback, play flow
    (popout/iframe/native placeholder)
13. `feat/game-stats` — streak, distribution, averages, PB, heatmap, history
14. `feat/pwa-shell` — manifest, service worker, offline page, install prompt
15. `test/embed-probe` — `probe-embeds.ts`, harness, report generation, GitHub Action

The two spikes come first, on `spike/workers-web-push` and `spike/realtime-room-auth`. They are
kept as real code that later branches build on, not throwaway branches.

---

## 17. Dependencies needing approval (outside the stated list)

| Package | Why | Alternative |
|---|---|---|
| `drizzle-kit`, `postgres` (postgres.js) | migrations; driver for web + worker | Drizzle needs some driver |
| `@upstash/redis`, `@upstash/ratelimit` | Upstash clients | hand-written REST calls |
| `yaml` | parse catalog YAML | none reasonable |
| `@node-rs/argon2` | argon2id on Vercel Node runtime (native, prebuilt) | `hash-wasm` (WASM argon2id, slower) |
| `qrcode` | render pairing QR (SVG). The approving phone scans it with its native camera, so no scanner library | hand-roll QR encoder (not worth it) |
| `@date-fns/tz` + `date-fns` | IANA tz math in shared code (Workers + Node) | raw `Intl` (doable, more error-prone) |
| `micromark` (+ GFM-strikethrough only) and `sanitize-html` | Markdown subset + allowlist sanitizer | `markdown-it` + DOMPurify/jsdom |
| shadcn baseline: `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` | shadcn/ui primitives; lucide for generic UI icons only (never game icons) | — |
| `motion` (the current name of Framer Motion) | stated in brief; flagging the package rename | — |
| `wrangler`, `@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers` | worker tooling/tests | — |
| `@axe-core/playwright`, `@lhci/cli` | a11y + Lighthouse in CI | — |
| `eslint`, `prettier`, `typescript`, `tsx` | tooling | — |
| Web push lib (TBD by spike) | Workers push | own implementation, no dep |

Satori comes through `next/og`, which is built into Next, so no dependency. The service worker
is hand-written, so no Serwist or Workbox. Confetti is our own canvas code. Vendored word lists
are the BIP39 English list (MIT), our own adjective and noun lists, and a profanity list from
LDNOOBW (CC-BY-4.0, credited in `docs/THIRD_PARTY.md`).

---

## 18. Confirmed decisions

1. Name **EveryDaily**. App at `everydaily.raycode.tech` (RP ID = this host), realtime at
   `rt.everydaily.raycode.tech`.
2. Full outbound network access is available for URL verification, share-text samples and the
   embed probe.
3. Only the branch names from section 16 are used.
4. Branches are merged directly into `main` once their gate passes, and `main` is pushed.
5. Section 17 dependencies are approved.
6. The owner deploys. The repo ships `.env.example`, `wrangler.toml`, Vercel config and a
   `docs/DEPLOY.md` with exact commands; no credentials ever enter the repo.

Remaining assumptions (override any time): solutions for the current puzzle are never shown;
current stable Next.js + Tailwind v4, pinned exactly; no under-13 targeting.
