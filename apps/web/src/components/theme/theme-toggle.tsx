'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export type Theme = 'system' | 'light' | 'dark';
const OPTIONS = [
  { value: 'system', label: 'Match device', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const;

/** Browser chrome colour for each look, kept in step with the theme tokens. */
const CHROME: Record<'light' | 'dark', string> = { light: '#FDF2E1', dark: '#170A2C' };

function read(): Theme {
  try {
    const t = localStorage.getItem('ed-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    localStorage.setItem('ed-theme', theme);
  } catch {
    // storage unavailable (private mode); the choice lasts for this page only
  }
  // The address bar and status bar follow the chosen look, not only the device's.
  const look =
    theme === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
    meta.content = CHROME[look];
}

/**
 * Match device / Light / Dark as three visible choices, so it is obvious which look is on and
 * that a tap changed it. Saved on this device.
 */
export function ThemeToggle({
  className,
  showLabels = false,
}: {
  className?: string;
  /** Text next to each icon (settings); icons only in the header. */
  showLabels?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => setTheme(read()), []);
  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn(
        'inline-flex rounded-md border-[length:var(--bw)] border-line bg-surface p-0.5 shadow-lift-sm',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const on = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            aria-label={`Theme: ${label}`}
            title={`Theme: ${label}`}
            onClick={() => {
              applyTheme(value);
              setTheme(value);
            }}
            className={cn(
              'inline-flex h-9 items-center justify-center gap-1.5 rounded-[calc(var(--r-md)-3px)] px-2.5 font-display text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40',
              on ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
              !showLabels && 'w-9 px-0',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {showLabels ? label : null}
          </button>
        );
      })}
    </div>
  );
}
