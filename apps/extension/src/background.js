import { createDedupe, describeReply, looksLikeShare, normalizeAppUrl } from './lib.js';

const fresh = createDedupe();

async function settings() {
  const { appUrl, token } = await chrome.storage.local.get(['appUrl', 'token']);
  return { appUrl: normalizeAppUrl(appUrl), token: typeof token === 'string' ? token : '' };
}

async function remember(entry) {
  await chrome.storage.local.set({ last: { ...entry, at: Date.now() } });
}

async function flash(tabId, badge, color) {
  if (!badge) return;
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text: badge, tabId });
  setTimeout(() => chrome.action.setBadgeText({ text: '', tabId }).catch(() => {}), 6000);
}

const COLORS = { saved: '#1E6B54', duplicate: '#555555', auth: '#B3261E', refused: '#B26A00' };

async function capture(text, pageUrl, tabId) {
  if (!looksLikeShare(text) || !fresh(text)) return;
  const { appUrl, token } = await settings();
  if (!appUrl || !token) {
    await remember({ kind: 'auth', text: 'Set up the extension: open its options.' });
    return flash(tabId, '?', COLORS.refused);
  }
  let res;
  try {
    res = await fetch(`${appUrl}/api/extension/capture`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ shareText: text, pageUrl }),
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch {
    await remember({ kind: 'error', text: 'Could not reach the app. Check the address.' });
    return flash(tabId, '!', COLORS.auth);
  }
  const body = await res.json().catch(() => ({}));
  const out = describeReply(res.status, body);
  await remember({ kind: out.kind, text: out.text });
  await flash(tabId, out.badge, COLORS[out.kind] ?? COLORS.auth);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  // Only our own content scripts, running in a tab, may ask us to send anything.
  if (sender.id !== chrome.runtime.id || !sender.tab || msg?.type !== 'capture') return;
  if (typeof msg.text !== 'string') return;
  void capture(msg.text, typeof msg.pageUrl === 'string' ? msg.pageUrl : undefined, sender.tab.id);
});

chrome.runtime.onInstalled.addListener((d) => {
  if (d.reason === 'install') void chrome.runtime.openOptionsPage();
});
