import { normalizeAppUrl, originPattern, validToken } from './lib.js';

const $ = (id) => document.getElementById(id);
const status = (text, bad = false) => {
  $('status').textContent = text;
  $('status').dataset.bad = bad ? '1' : '';
};

const saved = await chrome.storage.local.get(['appUrl', 'token']);
$('appUrl').value = saved.appUrl ?? '';
$('token').value = saved.token ?? '';

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const appUrl = normalizeAppUrl($('appUrl').value);
  const token = $('token').value.trim();
  if (!appUrl) return status('Use the https address of the app (http only for localhost).', true);
  if (!validToken(token)) return status('That does not look like an extension token.', true);

  // Reaching the app is a permission the player grants here, for this one address.
  const granted = await chrome.permissions.request({ origins: [originPattern(appUrl)] });
  if (!granted) return status('Permission to reach the app was not granted.', true);

  status('Testing…');
  try {
    const res = await fetch(`${appUrl}/api/extension/ping`, {
      headers: { authorization: `Bearer ${token}` },
      credentials: 'omit',
      cache: 'no-store',
    });
    if (res.status === 401) return status('The app did not accept that token.', true);
    if (!res.ok) return status(`The app answered with an error (${res.status}).`, true);
    const body = await res.json();
    await chrome.storage.local.set({ appUrl, token });
    status(`Connected as ${body.username}. Results you share will be saved.`);
  } catch {
    status('Could not reach the app at that address.', true);
  }
});
