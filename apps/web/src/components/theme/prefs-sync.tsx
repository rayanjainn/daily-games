'use client';

import { useEffect } from 'react';
import { applyPrefs, type Prefs } from '@/lib/prefs';

/** Brings this device in line with the preferences saved on the account. */
export function PrefsSync({ prefs }: { prefs: Prefs }) {
  const { sound, haptics, reducedMotion } = prefs;
  useEffect(() => {
    applyPrefs({ sound, haptics, reducedMotion });
  }, [sound, haptics, reducedMotion]);
  return null;
}
