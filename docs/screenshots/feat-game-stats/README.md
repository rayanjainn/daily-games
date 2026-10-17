# feat/game-stats — screenshot review

Screens: Wordle with about five months of history (gaps, losses, every score), The Mini with
ten timed results, and a check-off game. Phone, tablet, desktop; light and dark.

Checked and fixed:

- With a long history the calendar pushed the page wider than the phone screen (the capture was
  480 px wide). Grid and flex children now shrink, and the calendar scrolls sideways inside its
  own box with the newest week in view. An e2e test now fails if a phone page scrolls sideways.
- The guess distribution reserved a wide label column even for 1–6 and X; short labels now use
  a narrow column so the bars get the room.
- On desktop five stat tiles wrapped one tile onto a second row; they now fit on one row.

Verified: the bar for today's result is highlighted (and announced as "today"); losses count in
the X bar and in the solve rate but not in the average or best; times use lower-is-better;
check-off games show only streaks, the count and the calendar; the history is collapsed once it
is longer than a week.

Charts are plain HTML lists and grids rather than a chart library, so every bar and day is
readable by screen readers and nothing extra ships to the browser.
