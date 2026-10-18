# feat/deep-purple-theme

The dark theme is now a deep purple (page `#170A2C`, layered violet surfaces) instead of near-black,
and the theme control is three visible choices.

| Capture             | What it shows                                                            |
| ------------------- | ------------------------------------------------------------------------ |
| `today-freeze`      | Today in the new dark theme, with the Match device / Light / Dark switch |
| `today-freeze-used` | The same, with the note shown after a freeze covered a day               |

Checked:

- The switch is Match device, Light and Dark side by side, with the current one highlighted. The
  old single button cycled through three states and showed an icon that barely changed.
- Tests read the computed page colour after each choice: Dark is `rgb(23, 10, 44)`, Light is the warm
  paper, Match device follows the device, and the choice survives a reload (`design-system.spec.ts`).
- The browser's address bar colour follows the chosen theme, not only the device's.
- Every text pair still passes contrast (`tokens.test.ts`), and axe passes in both themes.
- The dark stat cards use the same purple.
