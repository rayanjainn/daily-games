import { describe, expect, it } from 'vitest';
import { proposeMode, type BrowserProbe, type HeaderProbe } from './probe';

const ok = (verdict: 'blocked' | 'allowed' | 'unknown', status = 200): HeaderProbe => ({
  ok: true,
  status,
  finalUrl: 'https://g.example/',
  verdict,
  reason: `headers ${verdict}`,
});
const frame = (over: Partial<BrowserProbe> = {}): BrowserProbe => ({
  loaded: true,
  refused: false,
  blank: false,
  frameBusting: false,
  status: 200,
  detail: '',
  ...over,
});

describe('proposeMode', () => {
  it('proposes iframe only when headers allow and the frame really loads', () => {
    expect(proposeMode('popout', ok('allowed'), frame())).toMatchObject({
      mode: 'iframe',
      changed: true,
      live: true,
    });
    expect(proposeMode('popout', ok('unknown'), frame())).toMatchObject({ mode: 'iframe' });
  });

  it('keeps popout for blocking headers, refusals, busting, blank and missing checks', () => {
    expect(proposeMode('popout', ok('blocked'), frame()).mode).toBe('popout');
    expect(proposeMode('popout', ok('allowed'), frame({ refused: true })).mode).toBe('popout');
    expect(proposeMode('popout', ok('allowed'), frame({ frameBusting: true })).mode).toBe('popout');
    expect(proposeMode('popout', ok('allowed'), frame({ blank: true })).mode).toBe('popout');
    expect(proposeMode('popout', ok('allowed'), frame({ loaded: false })).mode).toBe('popout');
    expect(proposeMode('popout', ok('allowed'), null).mode).toBe('popout');
    expect(proposeMode('popout', ok('blocked'), frame()).changed).toBe(false);
  });

  it('flags an iframe game that no longer frames, and dead pages', () => {
    expect(proposeMode('iframe', ok('blocked'), frame())).toMatchObject({
      mode: 'popout',
      changed: true,
    });
    expect(proposeMode('popout', ok('allowed', 404), frame())).toMatchObject({
      mode: 'popout',
      live: false,
    });
    expect(proposeMode('popout', { ok: false, error: 'ENOTFOUND' }, null)).toMatchObject({
      live: false,
    });
  });

  it('never touches native games', () => {
    expect(proposeMode('native', ok('blocked'), null)).toMatchObject({
      mode: 'native',
      changed: false,
    });
  });
});
