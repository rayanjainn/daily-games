# Spikes

## A. Web push from Cloudflare Workers

**Question:** can a Worker send standards-compliant web push (RFC 8291 aes128gcm + RFC 8292
VAPID) without the Node-only `web-push` package?

**Answer: yes.** Using `@block65/webcrypto-web-push@2.0.0` (Web Crypto only, MIT, one small
dependency `uint8array-extras`).

| Check                                                                                                                                                                                                                  | Result |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Library runs inside `workerd` (Vitest Workers pool)                                                                                                                                                                    | Pass   |
| Payload decrypts with an independent RFC 8291 implementation (`apps/worker/test/webpush-decrypt.ts`)                                                                                                                   | Pass   |
| VAPID JWT: ES256, signature verifies, `aud` = push origin, `exp` ≤ 24 h                                                                                                                                                | Pass   |
| `TTL`, `Urgency`, `Topic` headers set; invalid topics omitted                                                                                                                                                          | Pass   |
| Response classification: 2xx sent, 404/410 gone, 429/5xx retry (+Retry-After), other 4xx failed                                                                                                                        | Pass   |
| **Real end to end:** Chromium 141 subscribes via its real push service (FCM, `*.google.com`), the worker encrypts and signs, FCM returns `201 Created`, the browser's service worker receives and decrypts the payload | Pass   |

How to rerun: `xvfb-run -a pnpm tsx scripts/spikes/webpush/run.ts`.

Caveat about this build environment: the local `workerd` process cannot reach the internet
directly (no DNS, only an HTTP proxy), so `RELAY=1` lets the worker build the encrypted request
while the script performs the HTTPS POST. The bytes and headers sent to FCM are exactly what the
worker produced. On a normal machine, or in production, run without `RELAY` and the worker sends
it itself.

Not covered: Apple (`web.push.apple.com`) and Mozilla push services were not exercised
end to end. The library documents support for both (aes128gcm + `vapid` scheme); we will verify
on a real iPhone or Firefox after the first deploy.

## B. Durable Object WebSocket room authenticated by a Next.js token

**Question:** can the Next.js app mint short-lived tokens that a Cloudflare Durable Object
(Hibernation API) trusts, with per-room isolation, ordering, presence and survival across
hibernation?

**Answer: yes.** No new dependencies; Ed25519 and HMAC come from Web Crypto in both runtimes.

Design as built (matches PLAN.md section 10):

- `POST /api/realtime/token` (Next.js) signs `{sub, name, room, perms, iat, exp=+60s, jti}`
  with an Ed25519 private key. The worker only has the public key.
- The browser opens `wss://…/rt/<type>/<id>` with subprotocols `ed.v1, auth.<token>`, which keeps
  the token out of URLs and logs. The worker verifies signature, expiry, room = path and the
  `read` permission, then forwards to `RoomDO` (`idFromName(room)`), which enforces single use
  per `jti` and accepts the socket with `ctx.acceptWebSocket`.
- Persistent writes go through Next.js, which then calls `POST /internal/broadcast` (HMAC-signed,
  60 s window). The DO assigns a monotonic `seq` (SQLite storage) and keeps a 200-event ring
  buffer for `resume`.
- Typing (throttled to 1 per 3 s per socket) and presence go straight to the DO. `{"t":"ping"}`
  is answered by the runtime without waking the object.
- Sockets must `reauth` with a fresh token every 10 minutes; a sweep alarm closes stragglers with 4401.

| Check                                                                                                                                                                                                                                                                             | Where                                | Result     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------- |
| Token sign/verify, tamper, wrong key, expiry/skew, malformed input                                                                                                                                                                                                                | `packages/shared` unit tests         | Pass       |
| HMAC signing: wrong secret, altered body, stale timestamp                                                                                                                                                                                                                         | `packages/shared` unit tests         | Pass       |
| Upgrade auth: missing protocol/token, bad/expired token, wrong room, no `read`, unknown room type, replayed token                                                                                                                                                                 | workerd tests                        | Pass       |
| Ordered delivery to all sockets; bad broadcast signature refused                                                                                                                                                                                                                  | workerd tests                        | Pass       |
| Room isolation (no cross-room leakage)                                                                                                                                                                                                                                            | workerd tests                        | Pass       |
| Resume replays the gap; resync when the gap exceeds the buffer                                                                                                                                                                                                                    | workerd tests                        | Pass       |
| Presence join/leave; typing relay and throttle; typing needs permission; malformed frame closes 4400                                                                                                                                                                              | workerd tests                        | Pass       |
| **Hibernation:** evict the object with sockets hibernated → a new instance is constructed, the socket stays open, `seq` continues, presence is rebuilt from attachments                                                                                                           | workerd tests (`evictDurableObject`) | Pass       |
| Reauth extends deadline; another user's token closes 4401; deadline enforced on next message and by the alarm sweep                                                                                                                                                               | workerd tests                        | Pass       |
| **Live end to end:** `next dev` + `wrangler dev`, two real WebSocket clients: 401 for anonymous token request, connect, hello/presence, typing, three events published by Next.js arrive in order at both, token replay refused, wrong-room token refused, ping auto-reply, leave | `scripts/spikes/realtime/run.ts`     | 12/12 Pass |

How to rerun: `pnpm vitest run --project worker`. The live end-to-end script was retired in
Phase 3 once real sessions existed; `E2E_REALTIME=1` Playwright runs (`realtime.spec.ts`) now
cover the same path through the app's own UI and token route.

Notes:

- Until passkey sessions exist, the token route identifies users through a development-only
  header (`x-dev-user-id`). It returns 401 in production builds. It will be replaced by the
  session lookup in `feat/passkey-login`. The `/api/dev/broadcast` route is likewise
  development-only and will be removed once real writes publish events.
- A test-harness detail worth knowing: an unread `fetch` response body keeps a Durable Object
  referenced and blocks `evictDurableObject`. The test helpers always drain bodies.
- Room membership checks (group member, community visibility) belong to the social phase; the
  token route has a marked place for them.
