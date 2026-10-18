# feat/gaps

Captures for the gaps closed after Phases 3 and 4. Phone, tablet and desktop, light and dark.

| Capture            | What it shows                                                                        |
| ------------------ | ------------------------------------------------------------------------------------ |
| `badges-new`       | `/badges` with newly reached levels marked with a star                               |
| `board-moderation` | `/c/<board>/mod`: that board's reports, and its moderators (site moderators can edit) |
| `inline-spoiler`   | A post and a comment with `\|\|inline spoilers\|\|`, one revealed and one still hidden |
| `recap-dark-card`  | `/recap` with the Light card / Dark card switch on the dark style                    |

Checked:

- New badge levels are announced once (a toast on Today) and then marked seen (`badges.spec.ts`).
- Board moderators can act on their own board only, cannot appoint anyone, and every action is
  audit-logged; removing the appointment removes the access (`communities.spec.ts`).
- Inline spoilers are hidden from sight and screen readers until revealed, never appear in
  previews, and axe passes (`markdown.test.ts`, `communities.spec.ts`).
