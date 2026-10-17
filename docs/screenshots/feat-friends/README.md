# feat/friends

Phone, tablet and desktop, light and dark.

| Capture        | What it shows                                                                      |
| -------------- | ---------------------------------------------------------------------------------- |
| `friends-list` | Add by player name, a request to accept or decline, friends with today's count, and a sent request |
| `friends-h2h`  | You vs a friend: total wins and ties, per-game record, and today's results with theirs hidden until you log yours |

Checked and fixed:

- With a fourth tab (Friends) the phone tab bar wrapped "Settings" onto a second row; it now
  sizes itself to any number of tabs.
- A non-friend opening `/friends/<name>` gets a real 404, checked in a layout outside the
  loading boundary (`friends.spec.ts`).
- Blocking uses a confirmation dialog and answers like a missing player afterwards.
- Axe passes on the comparison page.
