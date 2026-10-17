import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPage } from '../src/health';

afterEach(() => vi.restoreAllMocks());

describe('checkPage', () => {
  it('keeps status and framing headers and discards the body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>big page</html>', {
        status: 200,
        headers: { 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'" },
      }),
    );
    expect(await checkPage('https://g.example/')).toEqual({
      ok: true,
      status: 200,
      finalUrl: 'https://g.example/',
      xFrameOptions: 'DENY',
      csp: "frame-ancestors 'none'",
      error: null,
    });
  });

  it('treats 4xx/5xx as failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('gone', { status: 410 }));
    expect(await checkPage('https://g.example/')).toMatchObject({ ok: false, error: 'HTTP 410' });
  });
});
