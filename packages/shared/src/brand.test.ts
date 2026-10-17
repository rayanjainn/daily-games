import { describe, expect, it } from 'vitest';
import { BRAND } from './brand';

describe('BRAND', () => {
  it('has a non-empty name and tagline', () => {
    expect(BRAND.name.length).toBeGreaterThan(0);
    expect(BRAND.tagline.length).toBeGreaterThan(0);
  });

  it('uses hex theme colors', () => {
    expect(BRAND.themeColor).toMatch(/^#[0-9A-F]{6}$/i);
    expect(BRAND.backgroundColor).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
