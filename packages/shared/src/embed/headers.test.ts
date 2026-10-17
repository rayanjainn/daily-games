import { describe, expect, it } from 'vitest';
import { analyzeFrameHeaders, frameAncestors } from './headers';

const US = 'https://everydaily.raycode.tech';
const PAGE = 'https://games.example.com/daily';

describe('frameAncestors', () => {
  it('returns null without the directive', () => {
    expect(frameAncestors(null)).toBeNull();
    expect(frameAncestors("default-src 'self'; script-src 'self'")).toBeNull();
  });

  it('parses sources case-insensitively', () => {
    expect(
      frameAncestors("default-src 'self'; Frame-Ancestors 'self' https://*.Example.com"),
    ).toEqual(["'self'", 'https://*.example.com']);
  });

  it('intersects multiple policies', () => {
    expect(
      frameAncestors(
        "frame-ancestors 'self' https://a.com https://b.com, frame-ancestors https://b.com",
      ),
    ).toEqual(['https://b.com']);
  });
});

describe('analyzeFrameHeaders', () => {
  it('blocks on X-Frame-Options DENY and SAMEORIGIN', () => {
    expect(analyzeFrameHeaders({ xFrameOptions: 'DENY' }, US, PAGE).verdict).toBe('blocked');
    expect(analyzeFrameHeaders({ xFrameOptions: 'sameorigin' }, US, PAGE).verdict).toBe('blocked');
  });

  it("blocks on frame-ancestors 'none' and on 'self' from another origin", () => {
    expect(analyzeFrameHeaders({ csp: "frame-ancestors 'none'" }, US, PAGE).verdict).toBe(
      'blocked',
    );
    expect(analyzeFrameHeaders({ csp: "frame-ancestors 'self'" }, US, PAGE).verdict).toBe(
      'blocked',
    );
  });

  it('lets CSP override X-Frame-Options', () => {
    const v = analyzeFrameHeaders(
      { xFrameOptions: 'DENY', csp: 'frame-ancestors https://*.raycode.tech' },
      US,
      PAGE,
    );
    expect(v.verdict).toBe('allowed');
  });

  it('matches wildcards, schemes and *', () => {
    expect(analyzeFrameHeaders({ csp: 'frame-ancestors *' }, US, PAGE).verdict).toBe('allowed');
    expect(analyzeFrameHeaders({ csp: 'frame-ancestors https:' }, US, PAGE).verdict).toBe(
      'allowed',
    );
    expect(
      analyzeFrameHeaders({ csp: 'frame-ancestors http://everydaily.raycode.tech' }, US, PAGE)
        .verdict,
    ).toBe('blocked');
    expect(
      analyzeFrameHeaders({ csp: 'frame-ancestors https://*.other.tech' }, US, PAGE).verdict,
    ).toBe('blocked');
  });

  it('is unknown without headers or with ALLOW-FROM', () => {
    expect(analyzeFrameHeaders({}, US, PAGE).verdict).toBe('unknown');
    expect(
      analyzeFrameHeaders({ xFrameOptions: 'ALLOW-FROM https://x.com' }, US, PAGE).verdict,
    ).toBe('unknown');
  });
});
