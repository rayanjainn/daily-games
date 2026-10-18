// Isolated-world relay: takes text from the page hook (and from plain copy events) and hands it
// to the background worker, which decides whether it looks like a result and whether to send it.
(() => {
  const forward = (text) => {
    if (typeof text !== 'string' || !text.trim() || text.length > 8000) return;
    try {
      chrome.runtime.sendMessage({ type: 'capture', text, pageUrl: location.href }).catch(() => {});
    } catch {
      /* the extension was reloaded; the page needs a refresh */
    }
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (d && d.__everydaily === 1) forward(d.text);
  });

  document.addEventListener(
    'copy',
    () => {
      const s = String(window.getSelection() || '');
      if (s) forward(s);
    },
    true,
  );
})();
