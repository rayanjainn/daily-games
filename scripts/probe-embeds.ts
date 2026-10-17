/**
 * Embed probe: for every game in the catalog,
 *  1. requests the page server-side and reads X-Frame-Options and CSP frame-ancestors,
 *  2. loads it in a sandboxed iframe in headless Chromium and watches for refusal (console
 *     "Refused to display/frame", an error page, a blank frame, frame busting, a timeout),
 *  3. writes docs/embed-probe/report.{json,md} with a proposed embedMode per game and a diff
 *     against the YAML.
 * It never edits YAML: switching a game to iframe also needs the publisher's permission.
 *
 * Usage:  pnpm probe:embeds [--only wordle,globle] [--check]
 *   --check  exit 1 if a game marked iframe in YAML no longer passes (for CI)
 * Behind an HTTP proxy, HTTPS_PROXY is used for the browser and NODE_USE_ENV_PROXY=1 for fetch.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';
import { analyzeFrameHeaders } from '@everydaily/shared/embed/headers';
import {
  proposeMode,
  type BrowserProbe,
  type HeaderProbe,
  type Proposal,
} from '@everydaily/shared/embed/probe';
import { loadGames } from '@everydaily/shared/registry/loader';

const EMBEDDER = process.env.APP_URL ?? 'https://everydaily.raycode.tech';
const OUT = fileURLToPath(new URL('../docs/embed-probe/', import.meta.url));
const FRAME_TIMEOUT_MS = 20_000;
const SETTLE_MS = 2_500;
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const onlyAt = args.findIndex((a) => a === '--only' || a.startsWith('--only='));
const only =
  onlyAt === -1
    ? null
    : args[onlyAt]!.includes('=')
      ? args[onlyAt]!.split('=')[1]!
      : (args[onlyAt + 1] ?? null);
const check = args.includes('--check');

interface Row {
  slug: string;
  name: string;
  url: string;
  current: string;
  header: HeaderProbe;
  browser: BrowserProbe | null;
  proposal: Proposal;
}

async function probeHeaders(url: string): Promise<HeaderProbe> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; EveryDailyEmbedProbe/1.0; +https://everydaily.raycode.tech)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    await res.body?.cancel();
    return {
      ok: true,
      status: res.status,
      finalUrl: res.url,
      ...analyzeFrameHeaders(
        {
          xFrameOptions: res.headers.get('x-frame-options'),
          csp: res.headers.get('content-security-policy'),
        },
        EMBEDDER,
        res.url,
      ),
    };
  } catch (err) {
    const e = err as Error & { cause?: { code?: string } };
    return { ok: false, error: e.cause?.code ?? e.name ?? 'error' };
  }
}

/**
 * The page that frames the game exactly the way the app does. It is served by request
 * interception on a reserved hostname, so nothing listens locally and no proxy is involved.
 */
const HARNESS_ORIGIN = 'https://embed-probe.everydaily.invalid';
const harnessHtml = (target: string) =>
  `<!doctype html><title>probe</title><body style="margin:0">` +
  `<iframe id="f" src="${target.replace(/"/g, '&quot;')}" style="width:480px;height:800px;border:0" ` +
  `sandbox="allow-scripts allow-same-origin allow-popups allow-forms" referrerpolicy="no-referrer"></iframe>` +
  `<script>document.getElementById('f').addEventListener('load',()=>{window.__loaded=true})</script>`;

async function probeBrowser(browser: Browser, url: string): Promise<BrowserProbe> {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.route(`${HARNESS_ORIGIN}/**`, (r) =>
    r.fulfill({ contentType: 'text/html; charset=utf-8', body: harnessHtml(url) }),
  );
  const page = await ctx.newPage();
  const notes: string[] = [];
  let refused = false;
  let frameBusting = false;
  let status: number | null = null;
  page.on('console', (m) => {
    const t = m.text();
    if (/Refused to (display|frame)/i.test(t)) {
      refused = true;
      notes.push(t.slice(0, 160));
    }
    if (/Unsafe attempt to initiate navigation|top-level/i.test(t)) frameBusting = true;
  });
  page.on('response', (r) => {
    if (r.request().isNavigationRequest() && r.frame() !== page.mainFrame() && status === null)
      status = r.status();
  });
  try {
    // Not 'load': that waits for the iframe too, which is what we are measuring.
    await page.goto(`${HARNESS_ORIGIN}/`, { waitUntil: 'domcontentloaded' });
    const loaded = await page
      .waitForFunction(
        () => (window as unknown as { __loaded?: boolean }).__loaded === true,
        null,
        {
          timeout: FRAME_TIMEOUT_MS,
        },
      )
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(SETTLE_MS);
    const frame = page.frames().find((f) => f.parentFrame() === page.mainFrame());
    const frameUrl = frame?.url() ?? '';
    if (frameUrl.startsWith('chrome-error://')) {
      refused = true;
      notes.push('error page');
    }
    let blank = false;
    if (loaded && frame && !refused) {
      blank = await frame
        .evaluate(
          () =>
            document.body === null ||
            (document.body.innerText.trim().length === 0 && document.body.children.length === 0),
        )
        .catch(() => false);
    }
    return {
      loaded,
      refused,
      blank,
      frameBusting,
      status,
      detail: notes[0] ?? (loaded ? 'loaded' : `no load event within ${FRAME_TIMEOUT_MS / 1000} s`),
    };
  } finally {
    await ctx.close();
  }
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

function markdown(rows: Row[], startedAt: string): string {
  const count = (pred: (r: Row) => boolean) => rows.filter(pred).length;
  const clip = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  const headerText = (h: HeaderProbe) =>
    !h.ok
      ? `unreachable (${h.error})`
      : h.verdict === 'unknown' && h.reason.startsWith('no framing headers')
        ? `${h.status} · no framing headers`
        : `${h.status} · ${h.verdict}: ${clip(h.reason)}`;
  const browserText = (b: BrowserProbe | null) =>
    !b
      ? 'skipped'
      : b.refused
        ? `refused: ${clip(b.detail)}`
        : b.frameBusting
          ? 'frame busting'
          : !b.loaded
            ? 'no load (slow or blocked)'
            : b.blank
              ? 'blank'
              : `loaded${b.status ? ` (${b.status})` : ''}`;
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  return [
    '# Embed probe report',
    '',
    `Run: ${startedAt} · embedder origin for header checks: \`${EMBEDDER}\``,
    '',
    `- Games probed: **${rows.length}**`,
    `- Reachable: **${count((r) => r.proposal.live)}**, unreachable or erroring: **${count((r) => !r.proposal.live)}**`,
    `- Headers block framing: **${count((r) => r.header.ok && r.header.verdict === 'blocked')}**`,
    `- Framing technically possible (headers allow and the frame loaded): **${count((r) => r.proposal.mode === 'iframe')}**`,
    `- Proposed changes to YAML: **${count((r) => r.proposal.changed)}**`,
    '',
    'A proposed `iframe` only means framing works technically. Switch a game only after checking',
    "the publisher's terms allow embedding, then set `embedMode` and `verifiedEmbeddableAt` in its YAML.",
    '',
    '| Game | YAML mode | Headers | Browser | Proposed | Change |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${esc(r.name)} | ${r.current} | ${esc(headerText(r.header))} | ${esc(browserText(r.browser))} | ${r.proposal.mode} | ${r.proposal.changed ? '**yes**' : ''} |`,
    ),
    '',
  ].join('\n');
}

const startedAt = new Date().toISOString();
const games = loadGames()
  .map((g) => g.spec)
  .filter((g) => !only || only.split(',').includes(g.slug))
  .sort((a, b) => a.slug.localeCompare(b.slug));

const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_BROWSERS_PATH === '/opt/pw-browsers'
    ? { executablePath: '/opt/pw-browsers/chromium' }
    : {}),
  ...(proxy ? { proxy: { server: proxy } } : {}),
});
try {
  const rows = await pool(games, CONCURRENCY, async (g): Promise<Row> => {
    const header = await probeHeaders(g.url);
    // Blocked or unreachable pages don't need a browser to confirm it.
    const needsBrowser =
      g.embedMode !== 'native' && header.ok && header.status < 400 && header.verdict !== 'blocked';
    const browserResult = needsBrowser
      ? await probeBrowser(browser, g.url).catch((err: Error): BrowserProbe => ({
          loaded: false,
          refused: false,
          blank: false,
          frameBusting: false,
          status: null,
          detail: `probe error: ${err.message.split('\n')[0]}`,
        }))
      : null;
    const proposal = proposeMode(g.embedMode, header, browserResult);
    console.log(
      `${proposal.changed ? '*' : ' '} ${g.slug.padEnd(22)} ${proposal.mode.padEnd(7)} ${proposal.why}`,
    );
    return {
      slug: g.slug,
      name: g.name,
      url: g.url,
      current: g.embedMode,
      header,
      browser: browserResult,
      proposal,
    };
  });

  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    `${OUT}report.json`,
    `${JSON.stringify({ startedAt, embedder: EMBEDDER, games: rows }, null, 2)}\n`,
  );
  writeFileSync(`${OUT}report.md`, markdown(rows, startedAt));
  console.log(`\nWrote ${OUT}report.json and report.md`);

  const broken = rows.filter((r) => r.current === 'iframe' && r.proposal.mode !== 'iframe');
  if (check && broken.length) {
    console.error(`iframe games that no longer pass: ${broken.map((r) => r.slug).join(', ')}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
