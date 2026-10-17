import { describe, expect, it } from 'vitest';
import {
  nextHealth,
  runHealthChecks,
  type CheckedGame,
  type HealthStore,
  type PageCheck,
} from './health';

describe('nextHealth', () => {
  it('marks a game possibly_down on the third failure in a row', () => {
    let s = { status: 'active' as const, consecutiveFailures: 0 };
    const a = nextHealth(s, false);
    const b = nextHealth(a, false);
    const c = nextHealth(b, false);
    expect([a, b, c].map((x) => [x.status, x.consecutiveFailures, x.transition])).toEqual([
      ['active', 1, null],
      ['active', 2, null],
      ['possibly_down', 3, 'down'],
    ]);
    // Further failures don't re-announce.
    expect(nextHealth(c, false)).toMatchObject({ status: 'possibly_down', transition: null });
    s = { status: 'active', consecutiveFailures: 2 };
    expect(nextHealth(s, true)).toEqual({
      status: 'active',
      consecutiveFailures: 0,
      transition: null,
    });
  });

  it('recovers on one success', () => {
    expect(nextHealth({ status: 'possibly_down', consecutiveFailures: 5 }, true)).toEqual({
      status: 'active',
      consecutiveFailures: 0,
      transition: 'recovered',
    });
  });

  it('never changes archived games', () => {
    expect(nextHealth({ status: 'archived', consecutiveFailures: 9 }, true)).toMatchObject({
      status: 'archived',
      transition: null,
    });
    expect(nextHealth({ status: 'archived', consecutiveFailures: 2 }, false).status).toBe(
      'archived',
    );
  });
});

function fakeStore(list: CheckedGame[]) {
  const log: string[] = [];
  const store: HealthStore = {
    listGames: async () => list,
    record: async (g, c, n) => {
      log.push(`record ${g.slug} ${c.ok ? 'ok' : 'fail'} ${n.consecutiveFailures}`);
    },
    setStatus: async (g, s) => {
      log.push(`status ${g.slug} ${s}`);
    },
    report: async (g, d) => {
      log.push(`report ${g.slug}: ${d}`);
    },
  };
  return { store, log };
}

const game = (slug: string, over: Partial<CheckedGame> = {}): CheckedGame => ({
  id: slug,
  slug,
  url: `https://${slug}.example/`,
  status: 'active',
  embedMode: 'popout',
  consecutiveFailures: 0,
  ...over,
});
const up = (over: Partial<PageCheck> = {}): PageCheck => ({
  ok: true,
  status: 200,
  finalUrl: null,
  xFrameOptions: null,
  csp: null,
  error: null,
  ...over,
});

describe('runHealthChecks', () => {
  it('records every game, reports outages, recoveries and lost framing', async () => {
    const { store, log } = fakeStore([
      game('fine'),
      game('flaky', { consecutiveFailures: 2 }),
      game('back', { status: 'possibly_down', consecutiveFailures: 4 }),
      game('framed', { embedMode: 'iframe' }),
    ]);
    const summary = await runHealthChecks({
      store,
      embedderOrigin: 'https://everydaily.raycode.tech',
      concurrency: 1,
      checkPage: async (url) =>
        url.includes('flaky')
          ? Promise.reject(new Error('ETIMEDOUT'))
          : url.includes('framed')
            ? up({ xFrameOptions: 'DENY' })
            : up(),
    });
    expect(summary).toEqual({
      checked: 4,
      failed: 1,
      down: ['flaky'],
      recovered: ['back'],
      framingLost: ['framed'],
    });
    expect(log).toContain('record flaky fail 3');
    expect(log).toContain('status flaky possibly_down');
    expect(log.find((l) => l.startsWith('report flaky'))).toContain('ETIMEDOUT');
    expect(log).toContain('status back active');
    expect(log.find((l) => l.startsWith('report framed'))).toContain('X-Frame-Options: DENY');
  });
});
