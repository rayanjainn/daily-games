# feat/game-notes

Phone, tablet and desktop, light and dark.

| Capture       | What it shows                                                  |
| ------------- | -------------------------------------------------------------- |
| `notes-empty` | The notes card on a game page before anything is written        |
| `notes-saved` | A two-line note after autosave, with the "Saved" status         |

Checked: the label is read by screen readers ("Your notes for Connections"), the save status is
a polite live region, the textarea focus ring is visible in both themes, and axe passes
(`notes.spec.ts`).
