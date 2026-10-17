# feat/dashboard — screenshot review

Screens: today with nothing followed (popular picks), a six-game checklist part-way done
(12-day Wordle streak, a check-off game, a game without public numbers), everything done (with a
failed Wordle shown as X/6), a combined streak at risk with long game names, and reorder mode.
Phone, tablet, desktop; light and dark.

Checked and fixed:

- "Today's games" wrapped onto two lines next to the Reorder and Add buttons on phones; it now
  stays on one line at a smaller size.
- The empty state drew a dashed box inside a card. The starter games now sit under their own
  "Popular picks" heading below the empty state.

Note: on phone captures the bottom tab bar appears part-way down the page. Full-page screenshots
draw fixed elements at their viewport position; in the browser it stays pinned.

Verified: done rows switch to the success tint with a check and the result summary; at-risk
streaks use the dashed flame plus a warning line; the first and last reorder buttons are
disabled; Play buttons open the game's own site in a new tab; confetti fires once per day only
when every followed game is done and never with reduced motion.
