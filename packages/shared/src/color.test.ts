import { describe, expect, it } from 'vitest';
import { contrastRatio, readableOn } from './color';
import { loadGames } from './registry/loader';

describe('color helpers', () => {
  it('computes known contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });

  it('picks readable text for light and dark backgrounds', () => {
    expect(readableOn('#F7DA21')).toBe('#1D1A3A');
    expect(readableOn('#052962')).toBe('#FFFFFF');
  });

  it('keeps text and glyphs legible on every game accent (4.5:1)', () => {
    for (const { spec } of loadGames()) {
      const ratio = contrastRatio(readableOn(spec.accentColor), spec.accentColor);
      expect(ratio, `${spec.slug} ${spec.accentColor}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
