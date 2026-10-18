# feat/dark-cards

Stat cards and posters now come in a dark style as well as the light one.

| Capture                     | What it shows                         |
| --------------------------- | ------------------------------------- |
| `week-poster-dark.png`      | The weekly poster in the dark style   |
| `month-poster-dark.png`     | The month poster in the dark style    |
| `game-card-wordle-dark.png` | A game stat card in the dark style    |

Checked:

- `?theme=dark` on any card route; anything else falls back to the light card (`cards.spec.ts`).
- The "Light card / Dark card" switch above each image picks the style, starting from how the app
  looks at the moment. Download names the dark file `-dark.png`.
- Text on the green and red fills stays dark so it keeps its contrast in both styles.
