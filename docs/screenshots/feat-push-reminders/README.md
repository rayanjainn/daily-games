# feat/push-reminders

Phone, tablet and desktop, light and dark.

| Capture                | What it shows                                                                  |
| ---------------------- | ------------------------------------------------------------------------------ |
| `reminders-off`        | The Reminders section with nothing set up: device state, toggles, per-game times |
| `reminders-configured` | Streak nudge at 20:30, quiet hours 22:00–07:30, Wordle at 08:00, one device    |

Checked and fixed:

- Time fields were too narrow for "08:30 PM" on phones; widened.
- Headless Chromium never grants notification permission on this origin, so both captures
  show the "blocked" device message. On a real browser the button reads "Turn on
  notifications", and once on, "Send a test" and "Turn off".
- Axe passes on the section (`reminders.spec.ts`).

Not captured: the notification itself (shown by the operating system, not the page).
