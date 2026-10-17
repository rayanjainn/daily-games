import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/fixtures';
import { signInAs } from './support/session';

test.describe('installable app', () => {
  test('serves a valid manifest with reachable icons', async ({ page, request }) => {
    await page.goto('/login');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    const manifest = (await res.json()) as {
      name: string;
      start_url: string;
      display: string;
      icons: { src: string; sizes: string; purpose: string; type: string }[];
    };
    expect(manifest).toMatchObject({ name: 'EveryDaily', display: 'standalone' });
    expect(manifest.start_url).toMatch(/^\/today/);
    expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(
      true,
    );
    for (const icon of manifest.icons) {
      const r = await request.get(icon.src);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()['content-type']).toContain(icon.type);
    }
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      /apple-touch-icon\.png/,
    );
  });

  test('the service worker is never cached by the browser', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('javascript');
    expect(res.headers()['cache-control']).toContain('no-store');
  });

  test('the offline page works on its own and is accessible', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('offers the browser install prompt in settings', async ({ page }) => {
    await signInAs(page);
    await page.goto('/settings');
    const box = page.getByTestId('install-app');
    await expect(box).toHaveAttribute('data-mode', 'manual');

    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      };
      (window as unknown as { __prompted: boolean }).__prompted = false;
      e.prompt = async () => {
        (window as unknown as { __prompted: boolean }).__prompted = true;
      };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
    await page.getByRole('button', { name: 'Install EveryDaily' }).click();
    await expect(box).toHaveAttribute('data-mode', 'installed');
    expect(
      await page.evaluate(() => (window as unknown as { __prompted: boolean }).__prompted),
    ).toBe(true);
  });
});

test.describe('offline shell', () => {
  test.use({ serviceWorkers: 'allow' });

  test('shows the offline page instead of a browser error, and never caches pages or APIs', async ({
    page,
    context,
  }) => {
    await signInAs(page);
    await page.goto('/today');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // The first load is not controlled; reload so the worker handles requests.
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);

    const cached = await page.evaluate(async () => {
      const keys = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) keys.push(new URL(req.url).pathname);
      }
      return keys;
    });
    expect(cached).toContain('/offline');
    expect(cached.some((k) => k.startsWith('/api/'))).toBe(false);
    expect(cached).not.toContain('/today');

    // Offline emulation reaches the worker's own fetches only with Playwright's service-worker
    // network events enabled (set in playwright.config.ts).
    await context.setOffline(true);
    await page.goto('/games/wordle');
    await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
    // Styles come from the cache too: the page is laid out, not raw HTML.
    const font = await page
      .getByRole('heading', { name: "You're offline" })
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font.toLowerCase()).toContain('fredoka');

    const api = await page.evaluate(() =>
      fetch('/api/games').then(
        () => 'answered',
        () => 'failed',
      ),
    );
    expect(api).toBe('failed');

    await context.setOffline(false);
    await page.getByRole('link', { name: 'Try again' }).click();
    await page.waitForURL((u) => u.pathname === '/today');
    await expect(page.getByTestId('today-headline')).toBeVisible();
  });
});
