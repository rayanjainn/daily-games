# feat/theme-polish

Phone, tablet and desktop, light and dark.

| Capture                       | What it shows                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `polish-games`                | Category colours: a dot on each filter chip and a tinted category badge on cards |
| `polish-today`                | The progress ring filled in each finished game's own colour; warmer light paper |
| `monochrome-icon-preview.png` | The one-colour icon for Android themed icons, shown on a dark tint             |

Checked and decided:

- Every category colour passes 4.5:1 on its soft background and on cards, in both themes
  (16 new pairs in `tokens.test.ts`).
- The tile flip plays only when a game turns done while the page is open, never on load, and
  is turned off for reduced motion like every other animation (`dashboard.spec.ts`).
- Light theme: paper and cards moved a step warmer (`#FDF2E1` paper, `#FFFCF6` cards); outlines
  kept at full strength because they carry the 3:1 component contrast.
- iOS tinted mode can't be set from a web app (it tints the existing icon itself), so only
  Android gets a dedicated monochrome icon.
