# EveryDaily

Follow, play and track daily puzzle games in one place: stats, streaks, reminders, friends and
communities.

See [PLAN.md](PLAN.md) for architecture and roadmap.

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
docker compose up -d            # or: scripts/local-services.sh start
pnpm test
```

Useful scripts:

| Command              | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `pnpm lint`          | ESLint across the workspace                    |
| `pnpm typecheck`     | `tsc` in every package                         |
| `pnpm test`          | Vitest across all projects                     |
| `pnpm format`        | Prettier                                       |
| `pnpm check:history` | Verifies commit authorship and message hygiene |
