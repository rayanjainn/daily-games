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
