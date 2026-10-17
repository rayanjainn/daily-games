# Embed probe

`pnpm probe:embeds` checks every game in `packages/shared/games/` and writes `report.json` and
`report.md` here. The committed report is the Phase 1 run; the weekly GitHub Action
(`.github/workflows/embed-probe.yml`) produces a fresh one as a run artifact.

For each game it:

1. requests the page from the server and reads `X-Frame-Options` and CSP `frame-ancestors`
   against the production origin (`APP_URL`, default `https://everydaily.raycode.tech`);
2. if the headers don't block framing, loads the page in a sandboxed iframe in headless
   Chromium (the same `sandbox` and `referrerpolicy` the app uses) and watches for a refusal in
   the console, an error page, no load event, an empty frame or an attempt to navigate the top
   window;
3. proposes an `embedMode` (`iframe` only when every signal agrees, otherwise `popout`).

The probe never edits YAML. To switch a game to `iframe`, also confirm the publisher allows
embedding, then set `embedMode: 'iframe'` and `verifiedEmbeddableAt` to the probe time in its
YAML. The schema refuses `iframe` without `verifiedEmbeddableAt`, and the app refuses to frame a
game without it.

Options: `--only wordle,globle` probes a subset; `--check` exits non-zero when a game marked
`iframe` no longer passes. Behind a proxy, `HTTPS_PROXY` is used for the browser and
`NODE_USE_ENV_PROXY=1` (set by the script) for the server-side requests.
