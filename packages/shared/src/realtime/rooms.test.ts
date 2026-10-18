import { describe, expect, it } from 'vitest';
import { parseRoom, roomName } from './rooms';

describe('rooms', () => {
  it('parses every room type', () => {
    expect(parseRoom('group:abc-123')).toEqual({ type: 'group', id: 'abc-123' });
    expect(parseRoom('thread:7f')).toEqual({ type: 'thread', id: '7f' });
    expect(parseRoom('community:everydaily')).toEqual({ type: 'community', id: 'everydaily' });
    expect(parseRoom('friends:0b2c-44')).toEqual({ type: 'friends', id: '0b2c-44' });
  });

  it('rejects unknown types and bad ids', () => {
    for (const bad of [
      'dm:abc',
      'friends:',
      'friends:UPPER',
      'group:a/b',
      'friends:' + 'a'.repeat(65),
    ])
      expect(parseRoom(bad)).toBeNull();
    expect(() => roomName('friends', 'no spaces')).toThrow();
  });
});
