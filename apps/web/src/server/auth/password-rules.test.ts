import { describe, expect, it } from 'vitest';
import { checkPasswordRules, PASSWORD_MIN } from './password-rules';

describe('checkPasswordRules', () => {
  it('accepts a long, unusual password', () => {
    expect(checkPasswordRules('tidal-velvet-otter-42', 'swift_owl')).toBeNull();
  });
  it('refuses short, long, repetitive and well-known passwords', () => {
    expect(checkPasswordRules('a'.repeat(PASSWORD_MIN - 1), 'x_y')).toMatch(/at least/);
    expect(checkPasswordRules('a'.repeat(200), 'x_y')).toMatch(/or fewer/);
    expect(checkPasswordRules('abababababab', 'x_y')).toMatch(/different characters/);
    expect(checkPasswordRules('Password123', 'x_y')).toMatch(/lists attackers/);
  });
  it('refuses passwords built from the player name', () => {
    expect(checkPasswordRules('Swift_Owl-2026!', 'swift_owl')).toMatch(/player name/);
    expect(checkPasswordRules('cosmic-river-stones', 'swift_owl')).toBeNull();
  });
});
