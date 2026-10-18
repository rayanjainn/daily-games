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

test('every response carries a request id, and a sane incoming one is kept', async ({
  request,
}) => {
  const fresh = await request.get('/api/health');
  expect(fresh.headers()['x-request-id']).toMatch(/^[\w-]{8,64}$/);

  const kept = await request.get('/api/health', { headers: { 'x-request-id': 'trace-12345678' } });
  expect(kept.headers()['x-request-id']).toBe('trace-12345678');

  const bad = await request.get('/api/health', {
    headers: { 'x-request-id': 'no spaces allowed!' },
  });
  expect(bad.headers()['x-request-id']).not.toBe('no spaces allowed!');
});
