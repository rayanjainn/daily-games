import {
  test as base,
  expect,
  type BrowserContext,
  type CDPSession,
  type Page,
} from '@playwright/test';

/** Each test looks like a different client IP, so per-IP rate limits don't bleed across tests. */
export function randomIp() {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
}

export interface VirtualAuthenticator {
  cdp: CDPSession;
  id: string;
  credentials(): Promise<
    { credentialId: string; isResidentCredential: boolean; signCount: number }[]
  >;
  setUserVerified(v: boolean): Promise<void>;
  remove(): Promise<void>;
}

/** Chrome DevTools Protocol virtual authenticator: a platform passkey with user verification. */
/**
 * `internal` is a platform authenticator (Touch ID / Windows Hello); Chrome allows one. Use `usb`
 * for a roaming security key.
 */
export async function addVirtualAuthenticator(
  page: Page,
  transport: 'internal' | 'usb' = 'internal',
): Promise<VirtualAuthenticator> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return {
    cdp,
    id: authenticatorId,
    credentials: async () =>
      (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials,
    setUserVerified: async (v) => {
      await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: v });
    },
    remove: async () => {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    },
  };
}

export const test = base.extend<{ ip: string }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures require an object pattern
  ip: async ({}, use) => use(randomIp()),
  context: async ({ context, ip }, use) => {
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': ip });
    await use(context);
  },
});

export { expect };
export type { BrowserContext, Page };
