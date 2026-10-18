// Runs in the page's own world so it can see what the game copies. It only forwards text to the
// content script (same window, same origin); it never talks to the network.
(() => {
  const send = (text) => {
    if (typeof text !== 'string' || !text || text.length > 8000) return;
    try {
      window.postMessage({ __everydaily: 1, text }, window.location.origin);
    } catch {
      /* the page is going away */
    }
  };

  const wrap = (proto, name, onCall) => {
    const original = proto && proto[name];
    if (typeof original !== 'function') return;
    proto[name] = function (...args) {
      try {
        onCall(args);
      } catch {
        /* never get in the game's way */
      }
      return original.apply(this, args);
    };
  };

  wrap(window.Clipboard && Clipboard.prototype, 'writeText', (a) => send(a[0]));
  wrap(window.Clipboard && Clipboard.prototype, 'write', (a) => {
    for (const item of a[0] || []) {
      if (item && item.types && item.types.includes('text/plain'))
        item
          .getType('text/plain')
          .then((b) => b.text())
          .then(send, () => {});
    }
  });
  wrap(window.Navigator && Navigator.prototype, 'share', (a) => {
    const d = a[0] || {};
    send([d.title, d.text, d.url].filter(Boolean).join('\n'));
  });
})();
