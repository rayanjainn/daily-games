import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/** Reads the CSRF cookie the app set and returns the header our API expects. */
export async function csrfHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name.endsWith('ed_csrf'))?.value ?? '';
  return {
    'x-csrf-token': token,
    origin: new URL(page.url()).origin,
    'content-type': 'application/json',
  };
}

export async function apiPost(
  page: Page,
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
) {
  return page.request.post(path, {
    data: body,
    headers: { ...(await csrfHeaders(page)), ...extra },
  });
}

/** Like apiPost, for PATCH and DELETE. */
export async function apiSend(page: Page, method: 'PATCH' | 'DELETE', path: string, body: unknown) {
  return page.request.fetch(path, { method, data: body, headers: await csrfHeaders(page) });
}

/** Completes the sign-up wizard in the UI with a passkey and skips the optional password. */
export async function signUpViaUi(page: Page, username?: string): Promise<{ username: string }> {
  await page.goto('/start');
  const input = page.getByLabel('Player name');
  if (username) await input.fill(username);
  const name = await input.inputValue();
  await expect(page.getByLabel('Available')).toBeVisible();
  await page.getByRole('button', { name: "That's me" }).click();
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await page.getByRole('button', { name: 'Skip, passkey only' }).click();
  await page.waitForURL(/\/today/);
  return { username: name };
}
