# feat/game-registry — screenshot review

Screen: `/styleguide`, new "Game icons" section with all 70 catalog games, at phone, tablet and
desktop, light and dark.

Checked and fixed:

- Seven accent colors could not carry text at 4.5:1 with either ink or white (Bandle, Clues by
  Sam, Contexto, Minute Cryptic, PokeDoku, Sedecordle, Songless). Adjusted; a test now enforces
  4.5:1 for every game accent.
- The Minute Cryptic motif read as a stray bar; redrawn as a padlock.
- Long names (Connections: Sports Edition) truncate with an ellipsis inside their cell instead of
  pushing the grid wider; no horizontal overflow at 390px.
