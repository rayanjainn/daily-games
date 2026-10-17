'use client';

import { useEffect } from 'react';

/** The browser's install prompt, kept so Settings can offer "Install" later. */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __edInstallPrompt?: InstallPromptEvent | null;
  }
}

export const INSTALL_EVENT = 'ed:install-available';

/**
 * Registers the service worker (production builds on secure origins only) and keeps the
 * install prompt, which browsers fire once and early.
 */
export function ServiceWorker() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__edInstallPrompt = e as InstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_EVENT));
    };
    const onInstalled = () => {
      window.__edInstallPrompt = null;
      window.dispatchEvent(new Event(INSTALL_EVENT));
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    if (
      process.env.NODE_ENV === 'production' &&
      'serviceWorker' in navigator &&
      window.isSecureContext
    ) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // The app works without it; only offline support is lost.
      });
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return null;
}
