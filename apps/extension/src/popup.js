import { normalizeAppUrl } from './lib.js';

const { appUrl, token, last } = await chrome.storage.local.get(['appUrl', 'token', 'last']);
const ready = Boolean(normalizeAppUrl(appUrl) && token);
document.getElementById('state').textContent = ready
  ? 'Ready. Press a game’s share button and the result is saved.'
  : 'Not set up yet. Open the options to add your app address and token.';
if (last) {
  const when = new Date(last.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('last').textContent = `Last: ${last.text} (${when})`;
}
document.getElementById('open').addEventListener('click', () => chrome.runtime.openOptionsPage());
