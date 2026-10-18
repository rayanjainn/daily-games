# Deploying EveryDaily

Production layout:

| Piece                                       | Where              | Address                                                         |
| ------------------------------------------- | ------------------ | --------------------------------------------------------------- |
| Web app (`apps/web`, Next.js)               | Vercel             | `https://everydaily.raycode.tech`                               |
| Worker (`apps/worker`: realtime, cron jobs) | Cloudflare Workers | `https://rt.everydaily.raycode.tech` (or `*.workers.dev`)       |
| Postgres                                    | Neon               | pooled URL for Vercel, direct URL for migrations and Hyperdrive |
| Redis (rate limits, challenges)             | Upstash            | REST URL + token                                                |

> **Pick the final domain before anyone signs up.** Passkeys are bound to the WebAuthn RP ID
> (`everydaily.raycode.tech`). Moving to another host later makes every existing passkey stop
> working there; people would have to recover with their phrase.

Every command below runs from the repository root unless it says otherwise.

## 0. Prerequisites

- Node 22 and pnpm 10: `corepack enable && corepack prepare pnpm@10.28.0 --activate`
- Accounts: Vercel, Cloudflare (with `raycode.tech` as a zone if you want `rt.` on your domain),
  Neon, Upstash.
- `git clone https://github.com/rayanjainn/daily-games.git && cd daily-games && pnpm install`

## 1. Generate secrets (once)

```sh
openssl rand -base64 48   # → AUTH_SECRET
pnpm keys:realtime        # → REALTIME_SIGNING_KEY, REALTIME_PUBLIC_KEY, INTERNAL_BROADCAST_SECRET
pnpm keys:vapid           # → VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
```

Keep these in a password manager. Where each one goes:

| Secret                      | Vercel                            | Worker           |
| --------------------------- | --------------------------------- | ---------------- |
| `AUTH_SECRET`               | yes                               | no               |
| `REALTIME_SIGNING_KEY`      | yes                               | no               |
| `REALTIME_PUBLIC_KEY`       | no                                | yes              |
| `INTERNAL_BROADCAST_SECRET` | yes                               | yes (same value) |
| `VAPID_PUBLIC_KEY`          | as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | yes              |
| `VAPID_PRIVATE_KEY`         | no                                | yes              |

## 2. Database (Neon)

In the Neon console copy two connection strings for your database: the **pooled** one (host
contains `-pooler`) and the **direct** one. Then create the schema and load the catalog with the
direct URL:

```sh
export DATABASE_URL='postgres://…direct…/neondb?sslmode=require'
pnpm db:migrate
pnpm seed:games
```

Re-run both whenever a release includes new migrations or catalog YAML changes (they are
idempotent; moderator edits survive re-seeding unless that game's YAML changed).

## 3. Redis (Upstash)

Create a Redis database (any region close to Vercel's). From its page copy the **REST URL** and
**REST token** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).

## 4. Worker (Cloudflare)

```sh
cd apps/worker
pnpm exec wrangler login
pnpm exec wrangler hyperdrive create everydaily-db --connection-string='postgres://…direct…/neondb?sslmode=require'
```

1. Put the returned Hyperdrive `id` into `apps/worker/wrangler.toml` (`[[hyperdrive]] id = …`)
   and commit it (it is not a secret).
2. If `raycode.tech` is a zone in this Cloudflare account, uncomment the `[[routes]]` block for
   `rt.everydaily.raycode.tech` in `wrangler.toml`. Otherwise the worker lives at
   `https://everydaily-worker.<your-subdomain>.workers.dev`; use that wherever this guide says
   `rt.everydaily.raycode.tech`.
3. Add the secrets (each command prompts for the value):

   ```sh
   pnpm exec wrangler secret put REALTIME_PUBLIC_KEY
   pnpm exec wrangler secret put INTERNAL_BROADCAST_SECRET
   pnpm exec wrangler secret put VAPID_PUBLIC_KEY
   pnpm exec wrangler secret put VAPID_PRIVATE_KEY
   ```

4. Create the reminders queue (once):

   ```sh
   pnpm exec wrangler queues create everydaily-reminders
   ```

5. Deploy and check it:

   ```sh
   pnpm run deploy
   curl https://rt.everydaily.raycode.tech/health   # {"ok":true,"service":"worker"}
   ```

`APP_URL` and `VAPID_SUBJECT` are plain vars in `wrangler.toml`; change them there if the domain
changes. Two cron triggers run (`[triggers]`):

- 04:17 UTC daily: the game health check; results show up in the moderation queue as "Health
  check" reports.
- Every 15 minutes: reminders. The cron works out who is due (per-game times, streak-at-risk
  nudges, quiet hours, each in the player's timezone), records each reminder so it is sent at
  most once, and puts them on the `everydaily-reminders` queue; the queue consumer sends the
  Web Push messages and removes expired subscriptions.

## 5. Web app (Vercel)

1. **Add New → Project →** import `rayanjainn/daily-games`.
2. **Root Directory:** `apps/web`. Framework preset: Next.js. Leave install and build commands
   as detected (pnpm workspaces are picked up from the repo root). Node.js version: 22.x.
   **Function region: the same region as your Neon database** (Settings → Functions → Function
   Region; e.g. Neon `aws-ap-southeast-1` → Vercel `sin1` Singapore, Neon `aws-us-east-1` →
   `iad1`). Every page makes a few database queries; across continents each one costs
   100–250 ms, which is the main cause of a slow site. Pick the Neon region closest to your
   players first, then match Vercel to it.
3. **Environment Variables** (Production):

   | Name                                                  | Value                                    |
   | ----------------------------------------------------- | ---------------------------------------- |
   | `APP_URL`                                             | `https://everydaily.raycode.tech`        |
   | `WEBAUTHN_RP_ID`                                      | `everydaily.raycode.tech`                |
   | `WEBAUTHN_RP_NAME`                                    | `EveryDaily`                             |
   | `WEBAUTHN_ORIGIN`                                     | `https://everydaily.raycode.tech`        |
   | `AUTH_SECRET`                                         | from step 1                              |
   | `POW_DIFFICULTY`                                      | `16`                                     |
   | `FEATURE_TURNSTILE`                                   | `0` (or `1` plus the two Turnstile keys) |
   | `FEATURE_SUBMISSIONS`                                 | `admin` (moderators only) — later `all`  |
   | `DATABASE_URL`                                        | Neon **pooled** URL                      |
   | `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | from step 3                              |
   | `REALTIME_URL`                                        | `wss://rt.everydaily.raycode.tech`       |
   | `WORKER_INTERNAL_URL`                                 | `https://rt.everydaily.raycode.tech`     |
   | `REALTIME_SIGNING_KEY`, `INTERNAL_BROADCAST_SECRET`   | from step 1                              |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`                        | VAPID public key from step 1             |
   | `RESEND_API_KEY`, `EMAIL_FROM` (optional)             | see "Optional: email" below              |

   Do not set `ENABLE_STYLEGUIDE` in production.

4. **Deploy.** Then **Settings → Domains → Add** `everydaily.raycode.tech`. In Cloudflare DNS for
   `raycode.tech` add the record Vercel shows (a `CNAME everydaily → cname.vercel-dns.com`) with
   the proxy **off** (grey cloud), so Vercel can issue the certificate.
5. Check: `curl https://everydaily.raycode.tech/api/health` → `{"ok":true,…}` (503 means the
   database or Redis is unreachable; check the URLs).

## Optional: email

Email is only used to confirm an address and, if a player turns it on, to send the same
reminders as push. Without it the app works and the Email section says it isn't set up.

1. In [Resend](https://resend.com) add and verify the domain `everydaily.raycode.tech` (it gives
   you DNS records to add in Cloudflare), then create an API key.
2. Vercel: set `RESEND_API_KEY` and `EMAIL_FROM` (for example
   `EveryDaily <hello@everydaily.raycode.tech>`).
3. Worker: `pnpm exec wrangler secret put RESEND_API_KEY`, and uncomment `EMAIL_FROM` in
   `wrangler.toml` with the same sender.

Never set `EMAIL_DEV_OUTBOX` in production; it only works when `APP_URL` is localhost anyway.

With email set up, the sign-in page also offers "Email me a sign-in link" for accounts that have a
confirmed address. Links work once and expire after 15 minutes.

### Optional: error alerts and request logs

The app writes one JSON log line per notable API request (server errors, rate limits, refusals and slow ones), with a request id that is also
returned in the `X-Request-Id` header. Secrets are never written to the logs. To also get
unexpected errors in a chat channel or an error tracker, set on Vercel:

- `ERROR_WEBHOOK_URL`: a webhook that accepts a JSON `POST` (a Slack-style `text` field plus the
  details). The same error is sent at most once a minute.
- `LOG_REQUESTS=1`: log every API request, not only failures and slow ones.

## Browser extension

The extension (`apps/extension`) is optional and installed by players. Build it with
`pnpm --filter @everydaily/extension build` (it lists the game sites from the catalog) and load
`apps/extension/dist`, or upload the zip next to it to a browser store. Players make a token in
Settings and paste it, with the app address, into the extension's options.

## 6. After the first deploy

1. Open `https://everydaily.raycode.tech`, sign up, create your passkey and save the recovery
   phrase.
2. Make yourself an admin (the only way roles change; there is no web endpoint for it):

   ```sh
   DATABASE_URL='…direct…' pnpm user:role <your-username> admin
   ```

   Reload: an **Admin** tab appears (moderation queue, game editor, audit log).

3. Optional, on a local or staging database only: `pnpm seed:demo --for <username>` fills an
   account with four months of sample results.

## 7. Releasing changes

- Pushing to `main` deploys the web app on Vercel automatically.
- Worker changes: `cd apps/worker && pnpm run deploy`.
- New migrations: run `pnpm db:migrate` against the direct URL **before** the web deploy that
  needs them. Catalog YAML changes: `pnpm seed:games`.
- CI (`.github/workflows/ci.yml`) runs lint, types, unit, e2e and visual tests on every push.
  The weekly **Embed probe** workflow uploads a fresh `docs/embed-probe` report; read it before
  switching any game to `iframe`.

## Troubleshooting

- **"The passkey prompt was cancelled or isn't available" on every device:** `WEBAUTHN_RP_ID`
  or `WEBAUTHN_ORIGIN` doesn't match the address in the browser exactly.
- **Requests blocked with "unexpected origin":** `APP_URL` differs from the real origin (for
  example a preview URL). Preview deployments need their own `APP_URL` and WebAuthn values.
- **`/api/health` returns 503:** wrong `DATABASE_URL` (use the pooled URL on Vercel) or Upstash
  credentials.
- **Health checks never run:** check **Workers → everydaily-worker → Triggers** shows the cron,
  and that the Hyperdrive id in `wrangler.toml` is the real one.
