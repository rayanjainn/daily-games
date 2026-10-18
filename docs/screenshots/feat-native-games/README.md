# feat/native-games

Phone, tablet and desktop, light and dark.

| Capture             | What it shows                                                                     |
| ------------------- | --------------------------------------------------------------------------------- |
| `cipher-play`       | Cipher mid-game: scored guesses, a half-built guess, the six symbols               |
| `cipher-result`     | The finished game: the result and a text to share (no symbols in it)              |
| `scramble-play`     | Scramble with two words found and a third being typed                             |
| `make-it-play`      | Make It: the target, the four numbers (used ones greyed) and an expression       |
| `native-game-page`  | A native game's page: "Today's best" board of everyone who played it here         |
| `today-with-natives`| Today with the three originals followed: plain tiles that link to play             |

Checked:

- The puzzle is built on the server from a key only the server has, so the code, words and
  numbers can't be worked out from the open-source code; moves are checked there too, and a
  finished puzzle takes no more moves (`native.spec.ts`).
- Results come from play only: pasting, typing in a score or ticking it off is refused for these
  games, so the "Today's best" board (verified results only) can't be faked.
- Players can hide themselves from the board in Settings and still see their own result.
- Axe passes on all three games, with colour-and-shape symbols in Cipher.
