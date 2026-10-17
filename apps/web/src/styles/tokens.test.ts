import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function block(selectorRe: RegExp): Record<string, string> {
  const m = selectorRe.exec(css);
  if (!m) throw new Error(`block not found: ${selectorRe}`);
  const start = css.indexOf('{', m.index) + 1;
  let depth = 1;
  let i = start;
  while (depth > 0) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') depth--;
    i++;
  }
  const body = css.slice(start, i - 1);
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((x) => [
      x[1]!,
      x[2]!.toLowerCase(),
    ]),
  );
}

const light = block(/^:root\s*\{/m);
const darkMedia = block(/:root:not\(\[data-theme='light'\]\)\s*\{/);
const darkExplicit = block(/^:root\[data-theme='dark'\]\s*\{/m);
const dark = { ...light, ...darkExplicit };

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [fg: string, bg: string][] = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink', 'surface-2'],
  ['ink', 'surface-3'],
  ['ink-soft', 'paper'],
  ['ink-soft', 'surface'],
  ['ink-soft', 'surface-2'],
  ['on-pop', 'pop'],
  ['on-grape', 'grape'],
  ['on-mint', 'mint'],
  ['on-sun', 'sun'],
  ['on-sky', 'sky'],
  ['on-bubblegum', 'bubblegum'],
  ['on-danger', 'danger'],
  ['success', 'paper'],
  ['warn', 'paper'],
  ['danger', 'paper'],
  ['info', 'paper'],
  ['success', 'success-soft'],
  ['warn', 'warn-soft'],
  ['danger', 'danger-soft'],
  ['info', 'info-soft'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, t) => {
  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(t[fg], `missing --${fg}`).toBeDefined();
    expect(t[bg], `missing --${bg}`).toBeDefined();
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('focus ring is visible against the page (3:1)', () => {
    expect(contrast(t['focus']!, t['paper']!)).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ['line', 'paper'],
    ['line', 'surface'],
  ])('component outline %s on %s is visible (WCAG 1.4.11, 3:1)', (fg, bg) => {
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(3);
  });

  it('faint text stays above 3:1 (used only for non-essential labels)', () => {
    expect(contrast(t['ink-faint']!, t['paper']!)).toBeGreaterThanOrEqual(3);
  });
});

describe('dark theme blocks', () => {
  it('system-dark and explicit-dark define identical colors', () => {
    expect(darkMedia).toEqual(darkExplicit);
  });
});
