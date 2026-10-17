/** WCAG relative luminance and contrast helpers for accent colors. */

const INK = '#1D1A3A';
const WHITE = '#FFFFFF';

export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`invalid hex color: ${hex}`);
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Ink or white, whichever reads better on `bg`. */
export function readableOn(bg: string): string {
  return contrastRatio(INK, bg) >= contrastRatio(WHITE, bg) ? INK : WHITE;
}
