# feat/passkey-settings — screenshot review

Screens: settings (profile, passkeys, recovery phrase, sessions, data); new recovery phrase
sheet; removing the last passkey; delete-account sheet. Phone, tablet, desktop; light and dark.
Also the new app shell: top navigation on tablet and desktop, bottom tab bar on phones.

Checked and fixed:

- The timezone select lost the user's saved zone when the browser lists it under a different
  ICU name (Asia/Kolkata vs Asia/Calcutta) and would have overwritten it on save. The saved and
  detected zones are now always options. Covered by an e2e test.
- The passkey created at sign-up showed "last used never" although it had just been used to
  sign in; sign-up now records that use.

Note: on phone captures the bottom tab bar appears part-way down the page. Full-page screenshots
draw fixed elements at their viewport position; in the browser it stays pinned to the bottom.

Verified: destructive actions are red, sit behind a confirmation sheet, and the delete button stays
disabled until the player name is typed; the account-loss warning shows only while the account has
a single sign-in method and no email.
