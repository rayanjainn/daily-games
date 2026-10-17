import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { extractMeta, fetchPageMeta, isBlockedAddress } = await import('./fetch-page');

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    'not-an-ip',
  ])('blocks %s', (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(['8.8.8.8', '172.32.0.1', '151.101.1.164', '2606:4700::6810:84e5'])('allows %s', (ip) =>
    expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe('fetchPageMeta', () => {
  it.each([
    'http://127.0.0.1/',
    'http://localhost/',
    'http://localhost:3000/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'https://user:pw@example.com/',
    'ftp://example.com/',
  ])('refuses %s before sending anything', async (url) => {
    await expect(fetchPageMeta(url)).rejects.toThrow();
  });
});

describe('extractMeta', () => {
  it('reads title and description in either attribute order and decodes entities', () => {
    expect(
      extractMeta(
        '<html><head><title> Daily &amp; Fun\n Game </title><meta content="Guess it &quot;today&quot;" name="description"></head>',
      ),
    ).toEqual({ title: 'Daily & Fun Game', description: 'Guess it "today"' });
    expect(extractMeta('<meta name="description" content="x">').description).toBe('x');
    expect(extractMeta('<p>no head</p>')).toEqual({ title: null, description: null });
  });
});
