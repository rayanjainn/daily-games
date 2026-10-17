# feat/design-tokens — screenshot review

Screens: `/styleguide` (full page), dialog open, toasts visible.
Viewports: phone 390×844, tablet 768×1024, desktop 1440×900. Themes: light, dark.

Checked and fixed during review:

- Dark theme: the outline token was near-black on a dark page, so cards, chips, inputs and the
  secondary button lost their edges. Outline changed to a violet (`#756dbf`), and a token test
  now enforces 3:1 for outlines against page and surface (WCAG 1.4.11).
- Light theme: success/warn/danger/info text colors failed 4.5:1 on the page and on their soft
  backgrounds. Darkened; covered by token tests.
- Axe: faded (opacity) labels on swatches and toast bodies failed contrast. Removed the opacity.
- The 64px progress ring's label overflowed. Small rings now use a smaller label and drop the
  sublabel.
- Logo inner details now use the on-accent color so they stay crisp in dark mode.

Verified: no horizontal overflow at 390px, long unbroken words wrap inside cards, the dialog is a
bottom sheet on phones and a centered card from 640px up, toasts sit above the thumb zone.
