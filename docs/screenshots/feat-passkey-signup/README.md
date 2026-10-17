# feat/passkey-signup — screenshot review

Screens: landing; sign-up steps (name, name error, long name, warm-up puzzle mid-solve,
passkey, passkey cancelled, recovery phrase, confirmation error). Phone 390×844, tablet 768×1024,
desktop 1440×900; light and dark.

Checked and fixed:

- The landing page's `Button asChild` passed two children to Radix Slot and crashed the page.
  `asChild` now renders exactly one child.
- Puzzle tiles wrapped onto two rows on phones and tablets. Tiles and slots now size down on
  small screens and the auth column is 32px wider, so six-letter words fit on one row everywhere.
- Disabled buttons in dark mode read as muddy brown (a 50%-faded accent on navy). Disabled is now
  a flat neutral tile; loading buttons keep their color.
- The landing icon wall wrapped 20 + 4; it now shows 21 icons (one row on desktop, three full
  rows on phones).
- Axe flagged availability icons that had an aria-label without a role; they are now `role="img"`.

Verified: no horizontal overflow at 390px; the recovery warning and phrase grid stay readable in
both themes; error states use the danger palette with an icon and text, not color alone.
