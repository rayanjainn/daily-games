import { expect, test } from './support/fixtures';

test('the health endpoint reports the database and Redis', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('no-store');
  expect(await res.json()).toMatchObject({
    ok: true,
    service: 'web',
    checks: { database: { ok: true }, redis: { ok: true } },
  });
});
