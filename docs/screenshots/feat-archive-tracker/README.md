# feat/archive-tracker

Phone, tablet and desktop, light and dark.

| Capture             | What it shows                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `archive-tracker`   | Catch up panel: 13-day strip (played, caught up from the archive, missed) and the missed list   |
| `archive-dialog`    | Logging a missed Wordle: link to the game's site, paste or enter a score for that puzzle        |
| `archive-caught-up` | A check-off game after catching up: "Caught up", the no-streak note, and the updated history    |

Checked:

- Missed days start at the follow date or first result, so a new follower sees no wall of misses.
- Catch-ups show "Archive ·" in the history and leave the streak unchanged (also covered by
  `archive.spec.ts` and `summary.test.ts`).
- Axe passes on the game page with the dialog flow (`archive.spec.ts`).
- The tall phone capture shows the sticky header mid-page; that is how full-page captures
  render sticky elements, not a layout bug.
