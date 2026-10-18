# EveryDaily capture (browser extension)

Saves the result a daily game copies when you press its share button, for games that can't be
played inside EveryDaily. Chrome and other Chromium browsers (Manifest V3).

## How it works

1. A small script in the game's page sees what the game copies (`navigator.clipboard.writeText`,
   `navigator.share`, or a plain copy).
2. The background worker drops anything that doesn't look like a result, then posts the text to
   `POST /api/extension/capture` with a bearer token. The server finds the game from the text and
   the page address and saves it exactly as a paste would (source `extension`).
3. The toolbar badge shows the outcome (✓ saved, = already logged, ! problem), and the popup shows
   the last one.

Nothing is sent from a site that isn't a game in the catalog, and nothing is sent unless it looks
like a result. The token can only add results.

## Build

```sh
pnpm --filter @everydaily/extension build        # apps/extension/dist and everydaily-extension.zip
pnpm --filter @everydaily/extension build:dev    # also runs on localhost, for local testing
```

The sites come from the game catalog (`games/*.yaml`): a game with a parser adds its site on the
next build.

## Install (unpacked)

1. Build, then open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and
   pick `apps/extension/dist`.
2. In EveryDaily, open **Settings → Browser extension** and make a token. It is shown once.
3. In the extension's options, enter the app address and the token, then **Save and test**. The
   browser asks permission to reach that one address.

Remove access any time from Settings; the token stops working immediately.

## Tests

- `lib.test.js`: the pure helpers (what looks like a result, address checks, replies).
- `apps/web/e2e/extension.spec.ts`: the token lifecycle and the capture API.
- `apps/web/e2e/extension-browser.spec.ts`: loads the built extension in Chromium and shares a
  result from a fake game page.
