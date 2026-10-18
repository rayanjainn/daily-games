# Game catalog

The catalog lives in `packages/shared/games/*.yaml`, one file per game, validated by
`gameSpecSchema` in CI. `pnpm seed:games` loads it into the database; `pnpm catalog:summary`
regenerates the client-side summary after edits.

## How games were verified (2026-10-17)

- **Live:** every URL returned HTTP 200 to a server-side request on 2026-10-17 (`verifiedLiveAt`).
- **Daily:** each game publishes one new puzzle per day, confirmed from the game page itself.
- **Numbering:** epochs for Tier 1 games come from the games' own code where readable
  (Worldle: days since 2022-01-21) or from dated puzzle numbers published by several outlets
  (Connections #1221 on 2026-10-14, Quordle #1725 on 2026-10-15, Octordle #1450 on 2026-01-13,
  Strands #946 on 2026-10-05, Wordle #1000 on 2024-03-15, Nerdle #1732 on 2026-10-17). Unit tests pin these.
- **Share formats:** Tier 1 and Tier 2 formats were read from each game's public client code
  (the function that builds the share text), not guessed from screenshots. Samples in the YAML
  use invented answers and themes; no puzzle content is copied. The Nerdle, Murdle and Clues by
  Sam samples are real shares from a player; parsers drop anything that is puzzle content (such
  as Murdle's mystery title).
- **Embedding:** every game starts as `popout`. Only the embed probe may set `iframe`.

## Tiers

| Tier | What it means                                              | Games  |
| ---- | ---------------------------------------------------------- | ------ |
| 1    | Dedicated parser, full stats (or an EveryDaily original)   | 16     |
| 2    | Generic parser (number, N/M, emoji grid) plus manual score | 7      |
| 3    | Link only: follow, reminders, done-today checkbox, streaks | 57     |
|      | **Total**                                                  | **80** |

### Tier 1

Three of these are EveryDaily originals (below). They are played in the app and record their own
results, so they have no parser and no pasted share text.

| Game           | Publisher          | Category  |
| -------------- | ------------------ | --------- |
| Cipher         | EveryDaily         | logic     |
| Clues by Sam   | Clues by Sam       | logic     |
| Connections    | The New York Times | word      |
| Globle         | Globle Game        | geography |
| Krillion       | Krillion           | trivia    |
| Make It        | EveryDaily         | math      |
| Minute Cryptic | Minute Cryptic     | crossword |
| Murdle         | G. T. Karber       | logic     |
| Nerdle         | Nerdle             | math      |
| Octordle       | Merriam-Webster    | word      |
| Quordle        | Merriam-Webster    | word      |
| Scramble       | EveryDaily         | word      |
| Strands        | The New York Times | word      |
| The Mini       | The New York Times | crossword |
| Wordle         | The New York Times | word      |
| Worldle        | Teuteuf            | geography |

### Tier 2

| Game           | Publisher     | Category  |
| -------------- | ------------- | --------- |
| Angle          | Angle         | math      |
| Bandle         | Bandle        | music     |
| Costcodle      | Costcodle     | trivia    |
| Emovi          | Teuteuf       | visual    |
| Flagle         | Teuteuf       | geography |
| Guess The Game | GuessThe.Game | visual    |
| Waffle         | Waffle Game   | word      |

### Tier 3

| Game                        | Publisher          | Category  |
| --------------------------- | ------------------ | --------- |
| Actorle                     | Actorle            | visual    |
| Catfishing                  | catfishing.net     | trivia    |
| Chronophoto                 | Chronophoto        | visual    |
| Colorfle                    | Colorfle           | visual    |
| Connections: Sports Edition | The Athletic       | trivia    |
| Contexto                    | Contexto           | word      |
| Countryle                   | Countryle          | geography |
| Crossclimb                  | LinkedIn           | word      |
| Dordle                      | Zaratustra         | word      |
| FoodGuessr                  | FoodGuessr         | geography |
| Framed                      | Framed             | visual    |
| Gamedle                     | Gamedle            | visual    |
| GeoGrid                     | GeoGrid            | geography |
| Gisnep                      | Gisnep             | word      |
| Globle: Capitals            | Globle Game        | geography |
| Heardle 80s                 | Heardle 80s        | music     |
| Hexcodle                    | Hexcodle           | visual    |
| Immaculate Grid             | Sports Reference   | trivia    |
| Letter Boxed                | The New York Times | word      |
| Lyricle                     | Lyricle            | music     |
| MapTap                      | MapTap             | geography |
| Mathler                     | Mathler            | math      |
| Metaflora                   | Metazooa           | trivia    |
| Metazooa                    | Metazooa           | trivia    |
| Mini Nerdle                 | Nerdle             | math      |
| Mini Sudoku                 | LinkedIn           | logic     |
| Numberle                    | Numberle           | math      |
| Phrazle                     | Solitaired         | word      |
| Pinpoint                    | LinkedIn           | word      |
| Pips                        | The New York Times | logic     |
| PokeDoku                    | PokeDoku           | trivia    |
| Puzzmo                      | Puzzmo             | logic     |
| Queens                      | LinkedIn           | logic     |
| Quick Crossword             | The Guardian       | crossword |
| Raddle                      | Raddle             | word      |
| Redactle                    | Redactle           | trivia    |
| Scrandle                    | Scrandle           | visual    |
| Sedecordle                  | Sedecordle         | word      |
| Semantle                    | Semantle           | word      |
| Songless                    | Less Games         | music     |
| Spelling Bee                | The New York Times | word      |
| Spotle                      | Spotle             | music     |
| Squaredle                   | Squaredle          | word      |
| Statele                     | Teuteuf            | geography |
| Sudoku                      | The New York Times | logic     |
| Tango                       | LinkedIn           | logic     |
| The Crossword               | The New York Times | crossword |
| Thrice                      | Geeks Who Drink    | trivia    |
| Tiles                       | The New York Times | logic     |
| TimeGuessr                  | TimeGuessr         | visual    |
| Tradle                      | OEC                | geography |
| Travle                      | Travle             | geography |
| Weaver                      | Weaver Games       | word      |
| WhenTaken                   | WhenTaken          | visual    |
| WhereTaken                  | Teuteuf            | geography |
| Wordiply                    | The Guardian       | word      |
| Zip                         | LinkedIn           | logic     |

Tier 2 results are keyed to the day they are logged (or the day picked for an archive entry);
the number in the share text is stored as metadata. That way an unverified epoch can never reject
a legitimate result.

The NYT daily crossword has no share text (only the Mini and Midi do), so it is Tier 3 with manual
time entry rather than a parser.

## Candidates dropped

| Candidate                                 | Reason                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| Moviedle                                  | Domain now redirects to an unrelated gambling site           |
| Posterdle                                 | Domain redirects to an unrelated site                        |
| NYT Digits                                | Discontinued; URL redirects to the crossword hub             |
| Episode                                   | Weekly, not daily                                            |
| Bracket City (The Atlantic)               | Blocks automated requests (403), so it could not be verified |
| The Washington Post Keyword               | No response to automated requests                            |
| Poeltl                                    | No response                                                  |
| Lettered, Dumble, Ghost, SET daily puzzle | No response                                                  |
| Daily Light Up (puzzle-light-up.com)      | 404                                                          |
| Spellcheck                                | Bot verification wall                                        |
| Britannica Tightrope                      | Bot verification wall                                        |
| The Times codewords                       | Device verification wall                                     |
| Crosswordle (vercel)                      | No sign of a daily puzzle                                    |
| Cine2Nerdle                               | Could not confirm a daily puzzle                             |
| Heardle (original)                        | Shut down                                                    |

Games that block automated checks may well be live; they can be added through the suggestion
flow once a moderator confirms them from a normal browser.

Krillion's Daily Dive share has no date or number ("KRILLION · THE DAILY DIVE" plus
"420/700 · 4,200 m"), so a pasted result counts for the current puzzle, which resets at 00:00 UTC
(read from the game code). Its themed rounds and practice rounds are not accepted. The games
added on 2026-10-17 (Krillion, Catfishing, MapTap, Gisnep, Globle: Capitals, Scrandle, Mini
Sudoku) were probed for framing: four load in a frame and three block it; all stay `popout`
until a publisher allows embedding.
