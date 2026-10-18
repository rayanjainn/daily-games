'use client';

import type { KeyboardEvent, MouseEvent } from 'react';

/**
 * Renders server-made, already-sanitized Markdown HTML and lets readers reveal `||spoilers||`
 * with a tap or Enter/Space. Revealing is a plain DOM change, so it survives re-renders that
 * pass the same HTML.
 */
export function RichHtml({ html, className }: { html: string; className?: string }) {
  function reveal(target: EventTarget | null) {
    const el = target instanceof Element ? target.closest('.spoiler') : null;
    if (!el || el.hasAttribute('data-shown')) return false;
    el.setAttribute('data-shown', 'true');
    for (const a of ['role', 'tabindex', 'aria-label']) el.removeAttribute(a);
    return true;
  }
  return (
    <div
      className={className}
      onClick={(e: MouseEvent) => {
        // Tapping a revealed spoiler (or a link inside one) does nothing extra.
        if (reveal(e.target)) e.preventDefault();
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && reveal(e.target)) e.preventDefault();
      }}
      // Rendered server-side from Markdown and passed through an allowlist sanitizer.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
