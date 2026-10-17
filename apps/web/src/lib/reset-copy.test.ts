import { describe, expect, it } from 'vitest';
import { cityOf, describeReset } from './reset-copy';

describe('describeReset', () => {
  it('describes local-midnight games', () => {
    expect(describeReset({ mode: 'user_local', hour: 0 }, 'Asia/Kolkata').headline).toBe(
      'New puzzle at midnight, your time',
    );
    expect(describeReset({ mode: 'user_local', hour: 3 }, 'UTC').headline).toBe(
      'New puzzle at 3 AM, your time',
    );
  });

  it('converts fixed-zone resets to the player clock', () => {
    // The Mini: 10 PM New York the evening before.
    const r = describeReset(
      { mode: 'fixed', timezone: 'America/New_York', hour: -2 },
      'Asia/Kolkata',
      new Date('2026-10-17T12:00:00Z'),
    );
    expect(r.headline).toBe('New puzzle at 10 PM the evening before, New York time');
    expect(r.detail).toBe("That's 7:30 AM where you are.");
  });

  it('skips the conversion when the player is in the same zone', () => {
    expect(
      describeReset({ mode: 'fixed', timezone: 'Europe/London', hour: 0 }, 'Europe/London').detail,
    ).toBeNull();
  });

  it('names cities', () => {
    expect(cityOf('America/Los_Angeles')).toBe('Los Angeles');
  });
});
