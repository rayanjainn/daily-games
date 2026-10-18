'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { applyPrefs, feedback, type Prefs } from '@/lib/prefs';

const ROWS = [
  {
    key: 'reducedMotion',
    id: 'pref-motion',
    label: 'Reduce motion',
    hint: 'No confetti or flips. Your device’s setting is always respected too.',
  },
  {
    key: 'sound',
    id: 'pref-sound',
    label: 'Sound effects',
    hint: 'A short chime when you log a result. Off unless you turn it on.',
  },
  {
    key: 'haptics',
    id: 'pref-haptics',
    label: 'Vibration',
    hint: 'A small buzz when you log a result, on phones that can do it.',
  },
] as const;

/** Settings: theme and the feel of the app. Applied on this device at once, saved to the account. */
export function AppearanceSection({ prefs }: { prefs: Prefs }) {
  const toast = useToast();
  const [state, setState] = useState<Required<Prefs>>({
    reducedMotion: Boolean(prefs.reducedMotion),
    sound: Boolean(prefs.sound),
    haptics: prefs.haptics !== false,
  });

  async function change(key: keyof Prefs, value: boolean) {
    const next = { ...state, [key]: value };
    try {
      await api('/api/me/profile', { prefs: { [key]: value } }, 'PATCH');
      setState(next);
      applyPrefs(next);
      if (value && (key === 'sound' || key === 'haptics')) feedback('done');
    } catch (err) {
      toast({
        tone: 'error',
        title: "Couldn't save",
        body: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      });
    }
  }

  return (
    <section aria-labelledby="appearance">
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 id="appearance" className="text-xl">
            Look and feel
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Light, dark or follow your device, and how much the app moves and makes noise.
          </p>
        </div>
        <ThemeToggle showLabels />
        {ROWS.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 border-t-2 border-line-soft pt-4"
          >
            <label htmlFor={r.id} className="font-display text-sm font-semibold">
              {r.label}
              <span className="block font-body text-xs font-normal text-ink-soft">{r.hint}</span>
            </label>
            <Switch
              id={r.id}
              checked={state[r.key]}
              onCheckedChange={(v) => void change(r.key, v)}
            />
          </div>
        ))}
      </Card>
    </section>
  );
}
