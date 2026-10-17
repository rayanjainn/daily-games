'use client';

import { CheckCircle2, Download, Share, SquarePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { INSTALL_EVENT } from './service-worker';

type Mode = 'checking' | 'installed' | 'prompt' | 'ios' | 'manual';

function detect(): Mode {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'installed';
  if (window.__edInstallPrompt) return 'prompt';
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return 'ios';
  return 'manual';
}

/** "Install the app": the browser's own prompt when offered, instructions otherwise. */
export function InstallApp() {
  const [mode, setMode] = useState<Mode>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const update = () => setMode(detect());
    update();
    window.addEventListener(INSTALL_EVENT, update);
    return () => window.removeEventListener(INSTALL_EVENT, update);
  }, []);

  async function install() {
    const prompt = window.__edInstallPrompt;
    if (!prompt) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      window.__edInstallPrompt = null;
      setMode(outcome === 'accepted' ? 'installed' : detect());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="install-heading">
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 id="install-heading" className="text-xl">
            Install the app
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Open EveryDaily from your home screen like any other app, full screen.
          </p>
        </div>
        <div data-testid="install-app" data-mode={mode}>
          {mode === 'installed' ? (
            <p className="inline-flex items-center gap-2 font-semibold text-success">
              <CheckCircle2 className="size-5" aria-hidden />
              Installed on this device
            </p>
          ) : mode === 'prompt' ? (
            <Button onClick={install} loading={busy}>
              <Download aria-hidden />
              Install EveryDaily
            </Button>
          ) : mode === 'ios' ? (
            <ol className="flex flex-col gap-2 text-sm">
              <li className="inline-flex items-center gap-2">
                <Share className="size-4 shrink-0" aria-hidden /> Tap Share in Safari&apos;s
                toolbar.
              </li>
              <li className="inline-flex items-center gap-2">
                <SquarePlus className="size-4 shrink-0" aria-hidden /> Choose “Add to Home Screen”.
              </li>
            </ol>
          ) : mode === 'manual' ? (
            <p className="text-sm text-ink-soft">
              Look for “Install” or “Add to Home screen” in your browser&apos;s menu.
            </p>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
