# feat/pwa-shell — screenshot review

Screens: the offline page, and the new "Install the app" section in Settings with the browser's
install prompt available and with the iPhone instructions. Phone, tablet, desktop; light and
dark. App icons (192, 512, maskable 512, Apple touch, favicon) are rendered from
`apps/web/public/icons/icon.svg` by `pnpm icons:generate` and were checked by eye, including the
maskable safe zone.

Checked and fixed:

- The timezone picker in Settings still used an unstyled native select; it now uses the shared
  Select with the same chevron as the rest of the app.
- Settings showed "Saved and checked" next to "You have no recovery phrase" for an account
  without a phrase; it now shows "None" in that case.

Verified: the offline page renders with its fonts and styles while offline (served from the
service worker's cache), uses plain links so "Try again" is a real reload, and the service
worker never stores pages or API responses, only the offline page and hashed build assets.
