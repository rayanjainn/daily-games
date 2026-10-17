# feat/communities

Phone, tablet and desktop, light and dark.

| Capture                  | What it shows                                                                  |
| ------------------------ | ------------------------------------------------------------------------------ |
| `community-index`        | The global board and a board for each followed game                            |
| `community-feed`         | A game board: pinned daily thread, hot/new sort, flair filter, voted posts     |
| `community-post`         | A post with Markdown, votes, report, and a threaded discussion with replies    |
| `community-daily-hidden` | Today's daily thread before you've played: comments hidden until you tap them  |

Checked:

- Markdown is limited to a safe subset and sanitized; raw HTML shows as text (`markdown.test.ts`,
  `communities.spec.ts`).
- Daily threads are created automatically and hide comments until you've logged that puzzle.
- Reports reach the moderation queue; removal hides content for everyone but moderators and is
  written to the audit log. Locked posts refuse comments.
- Axe passes on a post with comments.
