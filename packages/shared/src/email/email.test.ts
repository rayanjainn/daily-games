import { describe, expect, it } from 'vitest';
import { sendEmail } from './resend';
import { reminderEmail, verifyEmail } from './templates';

const config = { apiKey: 're_test', from: 'EveryDaily <hello@example.org>' };
const msg = verifyEmail('ava@example.org', 'https://everydaily.test/verify-email?token=abc');

function fake(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe('sendEmail', () => {
  it('posts to Resend with the key and message', async () => {
    const { f, calls } = fake(200, { id: 'em_1' });
    expect(await sendEmail(config, msg, f)).toEqual({ ok: true, id: 'em_1' });
    expect(calls[0]!.url).toBe('https://api.resend.com/emails');
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe('Bearer re_test');
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      from: config.from,
      to: 'ava@example.org',
      subject: 'Confirm your email for EveryDaily',
    });
  });

  it('marks rate limits and server errors as retryable, others not', async () => {
    expect(await sendEmail(config, msg, fake(429, {}).f)).toMatchObject({ ok: false, retry: true });
    expect(await sendEmail(config, msg, fake(503, {}).f)).toMatchObject({ ok: false, retry: true });
    expect(await sendEmail(config, msg, fake(422, {}).f)).toMatchObject({
      ok: false,
      retry: false,
    });
  });
});

describe('templates', () => {
  it('escapes content and builds absolute links', () => {
    const m = reminderEmail(
      'ava@example.org',
      { title: 'Q&A <is> waiting', body: 'Tap to play.', url: '/games/wordle', tag: 't' },
      'https://everydaily.test',
    );
    expect(m.html).toContain('Q&amp;A &lt;is&gt; waiting');
    expect(m.html).toContain('href="https://everydaily.test/games/wordle"');
    expect(m.text).toContain('https://everydaily.test/settings');
    expect(msg.text).toContain('https://everydaily.test/verify-email?token=abc');
  });
});
