'use client';

import { EyeOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** Blurs its content until the reader chooses to reveal it. */
export function Spoiler({ children, label = 'Spoiler' }: { children: ReactNode; label?: string }) {
  const [shown, setShown] = useState(false);
  if (shown) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      className="flex w-full items-center gap-2 rounded-md border-2 border-dashed border-line-soft bg-surface-2 px-3 py-2 text-left text-sm font-semibold text-ink-soft hover:text-ink"
      data-testid="spoiler"
    >
      <EyeOff className="size-4 shrink-0" aria-hidden />
      {label}: tap to reveal
    </button>
  );
}
