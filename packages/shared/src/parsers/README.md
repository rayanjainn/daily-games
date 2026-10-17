# Share-text parsers

Each parser turns the text a game copies to the clipboard into a result. Parsers only read
formats; they never fetch anything.

## Adding a parser

1. Find the real share format in the game's client code (the function that builds the share
   text), not from screenshots.
2. Add `<id>.ts` exporting a `Parser`:
   - `detect(text)`: a cheap header check used to route a paste to the right game.
   - `extract(text, ctx)`: returns `{ by: 'number' | 'date' | 'today', … }` or a `fail(code, message)`.
     Reject anything internally inconsistent (grid rows vs. score, duplicate solves, sums).
   - Never put the game's clue, theme or answer in `normalizedShareText`; it may be shown to
     other players.
3. Register it in `PARSERS` in `index.ts`.
4. Set `parserId` and add realistic `shareTextSamples` (invented answers) in the game's YAML.
   `parsers.test.ts` parses every sample automatically; add malformed and tampered cases next to
   the other games' tests.

`parseShareText` applies the shared checks after `extract`: input size, the epoch, future puzzles
(using the newest puzzle available anywhere on Earth) and number/date agreement.
