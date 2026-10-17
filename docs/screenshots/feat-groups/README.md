# feat/groups

Phone, tablet and desktop, light and dark.

| Capture               | What it shows                                                                         |
| --------------------- | ------------------------------------------------------------------------------------- |
| `groups-list`         | Your groups (owner crown, player counts), start a group, join by link or code          |
| `groups-board-hidden` | Today's board before you've played: who has played, no scores (spoiler-safe)           |
| `groups-board`        | After logging: ranked scores with your row highlighted, the week's board, members      |

Checked and fixed:

- Axe flagged the orange "(you)" text (3:1); your row is now highlighted with a background.
- On phones the invite link was squeezed into a narrow column; it now takes its own row.
- Old invite links stop working when replaced, and non-members get a real 404 (`groups.spec.ts`).
- An owner leaving hands the group to the longest-standing member.
