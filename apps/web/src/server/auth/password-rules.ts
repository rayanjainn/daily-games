/**
 * Password rules, kept free of server imports so they can be unit tested and shown in forms.
 * Length matters most (NIST 800-63B): no composition rules, but no well-known passwords and
 * nothing built from the player name.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** A short list of the passwords tried first in every credential-stuffing run. */
const COMMON = new Set([
  '1234567890',
  '12345678910',
  '0123456789',
  '1111111111',
  '0000000000',
  '1234512345',
  'qwertyuiop',
  'qwerty1234',
  'qwerty12345',
  '1q2w3e4r5t',
  '1qaz2wsx3edc',
  'asdfghjkl1',
  'password12',
  'password123',
  'password1234',
  'passw0rd123',
  'iloveyou12',
  'iloveyou123',
  'letmein123',
  'welcome123',
  'welcome1234',
  'monkey1234',
  'dragon1234',
  'football12',
  'baseball12',
  'sunshine12',
  'princess12',
  'superman12',
  'trustno1234',
  'abc1234567',
  'abcdefghij',
  'abcd123456',
  'zaq12wsxcde',
  'changeme123',
  'administrator',
  'adminadmin',
  'qwertyqwerty',
  'aaaaaaaaaa',
  'everydaily1',
  'everydaily123',
  'wordle12345',
  'loveyou1234',
]);

export function checkPasswordRules(password: string, username: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Keep it to ${PASSWORD_MAX} characters or fewer.`;
  const lower = password.toLowerCase();
  if (new Set(lower).size < 4) return 'Use a mix of more than a few different characters.';
  if (COMMON.has(lower)) return 'That password is on lists attackers try first. Pick another.';
  const name = username.toLowerCase().replace(/_/g, '');
  if (name.length >= 3 && lower.replace(/[^a-z0-9]/g, '').includes(name))
    return "Don't build your password from your player name.";
  return null;
}
