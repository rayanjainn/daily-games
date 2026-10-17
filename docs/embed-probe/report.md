# Embed probe report

Run: 2026-10-17T12:38:32.991Z · embedder origin for header checks: `https://everydaily.raycode.tech`

- Games probed: **70**
- Reachable: **70**, unreachable or erroring: **0**
- Headers block framing: **32**
- Framing technically possible (headers allow and the frame loaded): **34**
- Proposed changes to YAML: **34**

A proposed `iframe` only means framing works technically. Switch a game only after checking
the publisher's terms allow embedding, then set `embedMode` and `verifiedEmbeddableAt` in its YAML.

| Game | YAML mode | Headers | Browser | Proposed | Change |
|---|---|---|---|---|---|
| Actorle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Angle | popout | 200 · no framing headers | loaded (301) | iframe | **yes** |
| Bandle | popout | 200 · blocked: CSP frame-ancestors 'none' | skipped | popout |  |
| Chronophoto | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Clues by Sam | popout | 200 · blocked: CSP frame-ancestors 'none' | skipped | popout |  |
| Colorfle | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| Connections | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| Connections: Sports Edition | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| Contexto | popout | 200 · blocked: CSP frame-ancestors 'none' | skipped | popout |  |
| Costcodle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Countryle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Crossclimb | popout | 200 · blocked: CSP frame-ancestors: 'self' *.www.linkedin.com:* | skipped | popout |  |
| Dordle | popout | 200 · blocked: CSP frame-ancestors: 'self' https://itch.io | skipped | popout |  |
| Emovi | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Flagle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| FoodGuessr | popout | 200 · blocked: X-Frame-Options: SAMEORIGIN | skipped | popout |  |
| Framed | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Gamedle | popout | 200 · blocked: X-Frame-Options: SAMEORIGIN | skipped | popout |  |
| GeoGrid | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Globle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Quick Crossword | popout | 200 · blocked: X-Frame-Options: SAMEORIGIN | skipped | popout |  |
| Guess The Game | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Heardle 80s | popout | 200 · blocked: X-Frame-Options: SAMEORIGIN | skipped | popout |  |
| Hexcodle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Immaculate Grid | popout | 200 · blocked: CSP frame-ancestors: 'self' http://*.srdevel.com https://*.srdevel.co… | skipped | popout |  |
| Letter Boxed | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| Lyricle | popout | 200 · blocked: X-Frame-Options: SAMEORIGIN | skipped | popout |  |
| Mathler | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Metaflora | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Metazooa | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Minute Cryptic | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Murdle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Nerdle | popout | 200 · no framing headers | frame busting | popout |  |
| Mini Nerdle | popout | 200 · no framing headers | frame busting | popout |  |
| Numberle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| The Crossword | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| The Mini | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| Sudoku | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| Tiles | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| Octordle | popout | 200 · no framing headers | no load (slow or blocked) | popout |  |
| Phrazle | popout | 200 · blocked: X-Frame-Options: SAMEORIGIN | skipped | popout |  |
| Pinpoint | popout | 200 · blocked: CSP frame-ancestors: 'self' *.www.linkedin.com:* | skipped | popout |  |
| Pips | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| PokeDoku | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Puzzmo | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Queens | popout | 200 · blocked: CSP frame-ancestors: 'self' *.www.linkedin.com:* *.prod.linkedin.com … | skipped | popout |  |
| Quordle | popout | 200 · no framing headers | no load (slow or blocked) | popout |  |
| Raddle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Redactle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Sedecordle | popout | 200 · no framing headers | loaded (301) | iframe | **yes** |
| Semantle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Songless | popout | 200 · blocked: X-Frame-Options: SAMEORIGIN | skipped | popout |  |
| Spelling Bee | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| Spotle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Squaredle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Statele | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Strands | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| Tango | popout | 200 · blocked: CSP frame-ancestors: 'self' *.www.linkedin.com:* *.prod.linkedin.com … | skipped | popout |  |
| Thrice | popout | 200 · blocked: X-Frame-Options: SAMEORIGIN | skipped | popout |  |
| TimeGuessr | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Tradle | popout | 200 · blocked: X-Frame-Options: SAMEORIGIN | skipped | popout |  |
| Travle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Waffle | popout | 200 · blocked: CSP frame-ancestors: 'self' https://airmail.news https://*.airmail.ne… | skipped | popout |  |
| Weaver | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| WhenTaken | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| WhereTaken | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Wordiply | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Wordle | popout | 200 · blocked: X-Frame-Options: DENY | skipped | popout |  |
| Worldle | popout | 200 · no framing headers | loaded (200) | iframe | **yes** |
| Zip | popout | 200 · blocked: CSP frame-ancestors: 'self' *.www.linkedin.com:* *.prod.linkedin.com … | skipped | popout |  |
