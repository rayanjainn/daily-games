# feat/dark-theme — screenshot review

Dark mode only ("midnight arcade"). `before/` holds the same screens with the previous palette.

Changes:

- Page background from saturated purple (`#14122b`) to near-black indigo (`#0f0e1a`); cards and
  wells are quieter, cooler steps (`#18172a` → `#2c2946`), so content, not chrome, carries the
  color.
- Outlines from bright lavender (`#756dbf`) to slate violet (`#6e6899`): still 3.4–3.7:1 against
  page and cards (WCAG 1.4.11), but no longer shouting around every card.
- Accents slightly brighter so they glow on the darker base (pop, grape, mint, sun, sky) with
  their text colors re-checked at 4.5:1 or better.
- Surfaces get a faint top-lit sheen, so tiles read as raised pieces on a dark board.
- Browser chrome (`theme-color`) matches the new background.

All 53 token contrast tests pass for both themes; axe runs clean in dark on every e2e screen.
