# feat/community-solutions

Phone, tablet and desktop, light and dark.

| Capture              | What it shows                                                                      |
| -------------------- | ---------------------------------------------------------------------------------- |
| `solution-hidden`    | Yesterday's answer card with an approved answer, still hidden behind "Reveal"       |
| `solution-revealed`  | The answer revealed, credited to the player and linked to its source               |
| `solution-share`     | The share dialog rejecting a non-https, local link                                  |
| `solution-pending`   | The player's own answer waiting for a moderator                                    |
| `solution-mod-queue` | The moderation queue's Answers section with approve and reject                      |

Checked:

- Nothing is visible to other players before approval (`solutions.spec.ts`), and today's puzzle
  can never receive an answer.
- Source links open in a new tab with `noopener noreferrer nofollow ugc`.
- Approvals and rejections are written to the audit log.
- The mod queue capture includes answers sent from the other captures in the same run; that
  is test data, not duplication in the app.
