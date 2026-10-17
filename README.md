# EveryDaily

Follow, play and track daily puzzle games in one place: stats, streaks, reminders, friends and
communities.

See [PLAN.md](PLAN.md) for architecture and roadmap, and [docs/DEPLOY.md](docs/DEPLOY.md) to
put it in production.

## Layout

```
apps/web         Next.js app (Vercel)
apps/worker      Cloudflare Worker: cron, queues, realtime rooms
packages/shared  Schema, validators, game registry, parsers, brand constants
```

## Development

Requirements: Node 22, pnpm 10.

```sh
pnpm install
docker compose up -d            # Postgres, Redis and the Upstash shim
#   or without Docker: scripts/local-services.sh start && pnpm dev:redis-shim
cp .env.example apps/web/.env.local   # then set AUTH_SECRET (openssl rand -base64 48)
DATABASE_URL=postgres://everydaily:everydaily@localhost:5432/everydaily pnpm db:migrate
DATABASE_URL=postgres://everydaily:everydaily@localhost:5432/everydaily pnpm seed:games
pnpm --filter @everydaily/web dev     # http://localhost:3000
```

Passkeys work on `localhost`. After signing up, `pnpm seed:demo --for <username>` (with the same
`DATABASE_URL`) fills your account with sample history, and `pnpm user:role <username> admin`
opens the moderation tools.

Tests: `pnpm test` (unit, needs Postgres for the database tests) and
`pnpm --filter @everydaily/web exec playwright test --project e2e` (end to end; starts its own
server on port 3200).

Useful scripts:

| Command               | What it does                                   |
| --------------------- | ---------------------------------------------- |
| `pnpm lint`           | ESLint across the workspace                    |
| `pnpm typecheck`      | `tsc` in every package                         |
| `pnpm test`           | Vitest across all projects                     |
| `pnpm format`         | Prettier                                       |
| `pnpm check:history`  | Verifies commit authorship and message hygiene |
| `pnpm db:migrate`     | Applies database migrations (`DATABASE_URL`)   |
| `pnpm seed:games`     | Loads the game catalog YAML into the database  |
| `pnpm seed:demo`      | Demo players and results (see the script)      |
| `pnpm user:role`      | Grants or removes moderator/admin rights       |
| `pnpm probe:embeds`   | Embed probe report (`docs/embed-probe/`)       |
| `pnpm icons:generate` | Re-renders the app icons from the SVG          |
| `pnpm keys:realtime`  | Generates realtime signing keys                |
| `pnpm keys:vapid`     | Generates web push (VAPID) keys                |
