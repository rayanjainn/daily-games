# feat/realtime-ui

Phone, tablet and desktop, light and dark, captured with the worker running
(`E2E_REALTIME=1`).

| Capture           | What it shows                                                        |
| ----------------- | -------------------------------------------------------------------- |
| `realtime-thread` | A post with two readers: "Live · 2 here" and the other reader typing |

Checked (`realtime.spec.ts`, against `wrangler dev`):

- A comment posted by one reader appears for the other without a reload; typing and presence
  update both ways, and presence drops when a reader leaves.
- A group board refreshes when a member logs a result.
- Players outside a group are refused a token for its room (403).
- With live updates off (no worker configured), pages work as before and the live bar stays
  hidden; the client stops asking for tokens instead of retrying.
- Reconnects use exponential backoff with full jitter and resume from the last event
  (`room-client.test.ts`).
