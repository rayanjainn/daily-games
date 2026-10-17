'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Theme = 'system' | 'light' | 'dark';
const ORDER: Theme[] = ['system', 'light', 'dark'];
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;
const LABEL = {
  system: 'Theme: match device',
  light: 'Theme: light',
  dark: 'Theme: dark',
} as const;

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
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => setTheme(read()), []);
  const Icon = ICON[theme];
  return (
    <button
      type="button"
      onClick={() => {
        const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
        applyTheme(next);
        setTheme(next);
      }}
      className={cn(
        'inline-grid size-11 place-items-center rounded-md border-[length:var(--bw)] border-line bg-surface text-ink shadow-lift-sm',
        'transition-transform active:translate-y-[var(--lift-sm)] active:shadow-none',
        className,
      )}
      aria-label={LABEL[theme]}
      title={LABEL[theme]}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
