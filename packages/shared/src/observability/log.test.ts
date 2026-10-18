import { describe, expect, it } from 'vitest';
import { createThrottle, describeError, formatLine, redact } from './log';

describe('redact', () => {
  it('hides secret-looking fields at any depth and trims long strings', () => {
    const out = redact({
      path: '/api/x',
      authorization: 'Bearer abc',
      nested: { sessionToken: 't', ok: 1 },
      shareText: 'Wordle 1 3/6',
      long: 'x'.repeat(900),
    }) as Record<string, unknown>;
    expect(out.path).toBe('/api/x');
    expect(out.authorization).toBe('[redacted]');
    expect((out.nested as Record<string, unknown>).sessionToken).toBe('[redacted]');
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
    expect(out.shareText).toBe('[redacted]');
    expect((out.long as string).length).toBe(501);
  });
});

describe('formatLine', () => {
  it('is one JSON line with level and time', () => {
    const line = formatLine(
      'warn',
      'slow',
      { ms: 1200, token: 'x' },
      new Date('2026-01-02T03:04:05Z'),
    );
    expect(line).not.toContain('\n');
    expect(JSON.parse(line)).toEqual({
      ts: '2026-01-02T03:04:05.000Z',
      level: 'warn',
      msg: 'slow',
      ms: 1200,
      token: '[redacted]',
    });
  });
});

describe('describeError and createThrottle', () => {
  it('describes errors and non-errors', () => {
    expect(describeError(new TypeError('bad'))).toMatchObject({
      name: 'TypeError',
      message: 'bad',
    });
    expect(describeError('boom')).toEqual({ name: 'NonError', message: 'boom' });
  });
  it('lets one of each key through per window', () => {
    let t = 0;
    const ok = createThrottle(1000, () => t);
    expect(ok('a')).toBe(true);
    expect(ok('a')).toBe(false);
    expect(ok('b')).toBe(true);
    t = 1500;
    expect(ok('a')).toBe(true);
  });
});
