# feat/result-logging — screenshot review

Screens: pasting a Wordle share with its live preview; a share for a puzzle that is not out yet;
manual time entry for The Mini; the check-off panel for a Tier 3 game; the saved state with the
streak line; a game already logged today; the popup-blocked fallback; and the dashboard's log
sheet on a phone. Phone, tablet, desktop; light and dark.

Checked and fixed:

- The share box was too short for a full Wordle share, so the header scrolled out of view. It is
  now tall enough for a six-row grid.
- On wide screens the Today card stretched to the height of the log panel and left a large empty
  block; the cards now keep their own height.
- When a popup was blocked the Play button stretched across the card; on phones it then lost
  its full width. It keeps its normal size, and is full width on phones as before.
- A failed Wordle read "Not solved" because the share has no guess count for a loss; it now
  reads X/6 everywhere.

Note: on phone captures the sticky header and bottom tab bar can appear part-way down the page.
Full-page screenshots draw fixed elements at their viewport position; in the browser they stay
pinned.

Verified: Save stays disabled until the preview matches the text in the box and while a
duplicate or error is shown; errors are announced (role=alert) and tied to the field; the
blocked-popup link uses noopener/noreferrer; the preview shows only what will be saved.
