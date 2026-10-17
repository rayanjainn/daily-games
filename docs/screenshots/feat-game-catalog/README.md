# feat/game-catalog — screenshot review

Screens: catalog (all games, search, category + difficulty filter, no match, empty "Following"),
game pages (Wordle; The Mini with a fixed New York reset seen from Asia/Kolkata; a long name),
the report sheet, the suggestion form with errors, and the moderation queue, game list and game
editor showing rule warnings. Phone, tablet, desktop; light and dark.

Checked and fixed:

- Filter selects had no dropdown arrow (the background-image utility did not compile). `Select`
  now draws a chevron icon over the native control.
- Reports from players who later deleted their account were labelled "Automatic". Only the
  worker's `auto` kind is labelled as a health check now.
- A full date as "Today" (games without public numbers) wrapped heavily at the number size; it
  now uses a smaller size.
- The epoch date field in the game editor was too narrow for the native date picker.
- Heading order: catalog cards and empty states now sit under an h2, so the outline is h1 → h2 → h3
  (caught by axe).

Note: on phone captures the bottom tab bar and sticky header can appear part-way down the page.
Full-page screenshots draw fixed elements at their viewport position; in the browser they stay
pinned.

Verified: follow buttons have their own focus target above the card's stretched link; tracking
level is shown as player-facing labels (Full stats / Score log / Check-off) rather than tier
numbers; every game page carries the "not affiliated" attribution line; moderators only see the
Admin tab; "Where it plays → Plays here" is disabled until an embed probe passes.
