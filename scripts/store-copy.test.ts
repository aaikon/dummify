import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strings as onboarding } from '../src/onboarding/strings';
import { strings as popup } from '../src/popup/strings';

/**
 * Copy users see before and after install may only promise what has shipped (T-013). When a feature ships, remove
 * its words here in the same change that adds it to the copy.
 */
const UNSHIPPED = [
  'reels', // T-020
  'instagram', // T-020
  'facebook', // T-020
  'tiktok', // T-021
  'autoplay', // T-022
  'recommendation', // T-022, T-023
  'bing', // T-024
  'duckduckgo', // T-024
  'smart compose', // T-025
  'smart repl', // T-025
];

const pkg: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
const description =
  typeof pkg === 'object' &&
  pkg !== null &&
  'description' in pkg &&
  typeof pkg.description === 'string'
    ? pkg.description
    : '';

/** Every string in a (nested) strings module. */
function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(allStrings);
  return [];
}

describe('store-facing copy (T-013)', () => {
  it('manifest description (from package.json) starts with the tagline and fits the store limit', () => {
    expect(description.startsWith('dummify takes the "smart" out of the web')).toBe(true);
    // Chrome Web Store rejects a manifest description longer than 132 characters.
    expect(description.length).toBeLessThanOrEqual(132);
  });

  it.each([
    ['manifest description', [description]],
    ['popup', allStrings(popup)],
    ['onboarding', allStrings(onboarding)],
    ['privacy policy', [readFileSync('PRIVACY.md', 'utf8')]],
  ])('%s promises no unshipped feature', (_name, texts) => {
    for (const text of texts)
      for (const word of UNSHIPPED)
        expect(text.toLowerCase(), `"${word}" in: ${text}`).not.toContain(word);
  });
});
