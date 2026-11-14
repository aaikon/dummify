import { describe, expect, it } from 'vitest';
import { isBlockedCountMessage } from './messages';

describe('isBlockedCountMessage', () => {
  it('accepts a well-formed message', () => {
    expect(isBlockedCountMessage({ type: 'dummify:blocked-count', count: 3 })).toBe(true);
    expect(isBlockedCountMessage({ type: 'dummify:blocked-count', count: 0 })).toBe(true);
  });

  it.each([
    null,
    undefined,
    'dummify:blocked-count',
    { type: 'other', count: 1 },
    { type: 'dummify:blocked-count' },
    { type: 'dummify:blocked-count', count: '3' },
    { type: 'dummify:blocked-count', count: -1 },
    { type: 'dummify:blocked-count', count: 1.5 },
  ])('rejects %j', (message) => {
    expect(isBlockedCountMessage(message)).toBe(false);
  });
});
