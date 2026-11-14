import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  enabledCategories,
  heuristicsEnabled,
  isCategoryEnabled,
  setCategory,
  isBlockingActive,
  isSiteDisabled,
  setSiteEnabled,
  type Settings,
  withDefaults,
} from './settings';

const s = (patch: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

describe('isBlockingActive', () => {
  it('is on everywhere by default', () => {
    expect(isBlockingActive(DEFAULT_SETTINGS, 'google.com')).toBe(true);
  });

  it('is off everywhere when globally disabled', () => {
    expect(isBlockingActive(s({ enabled: false }), 'google.com')).toBe(false);
  });

  it('is off on a disabled site and its subdomains only', () => {
    const settings = s({ disabledSites: ['example.com'] });
    expect(isBlockingActive(settings, 'example.com')).toBe(false);
    expect(isBlockingActive(settings, 'docs.example.com')).toBe(false);
    expect(isBlockingActive(settings, 'notexample.com')).toBe(true);
    expect(isBlockingActive(settings, 'google.com')).toBe(true);
  });
});

describe('isSiteDisabled', () => {
  it('ignores the master switch', () => {
    expect(isSiteDisabled(s({ enabled: false }), 'example.com')).toBe(false);
    expect(
      isSiteDisabled(s({ enabled: false, disabledSites: ['example.com'] }), 'example.com'),
    ).toBe(true);
  });
});

describe('setSiteEnabled', () => {
  it('turning a site off adds it once, sorted', () => {
    const once = setSiteEnabled(s({ disabledSites: ['zeta.io'] }), 'alpha.io', false);
    expect(once.disabledSites).toEqual(['alpha.io', 'zeta.io']);
    expect(setSiteEnabled(once, 'alpha.io', false)).toBe(once);
  });

  it('turning a subdomain off is a no-op when its parent is already off', () => {
    const settings = s({ disabledSites: ['example.com'] });
    expect(setSiteEnabled(settings, 'docs.example.com', false)).toBe(settings);
  });

  it('turning a site on removes it and any parent entry that covers it', () => {
    const settings = s({ disabledSites: ['example.com', 'docs.example.com', 'other.org'] });
    expect(setSiteEnabled(settings, 'docs.example.com', true).disabledSites).toEqual(['other.org']);
  });

  it('turning a parent on keeps subdomains that were turned off separately', () => {
    const settings = s({ disabledSites: ['docs.example.com'] });
    expect(setSiteEnabled(settings, 'example.com', true).disabledSites).toEqual([
      'docs.example.com',
    ]);
  });

  it('does not mutate its input', () => {
    const settings = s({ disabledSites: ['a.com'] });
    setSiteEnabled(settings, 'b.com', false);
    setSiteEnabled(settings, 'a.com', true);
    expect(settings.disabledSites).toEqual(['a.com']);
  });
});

describe('withDefaults', () => {
  it('adds fields missing from older stored settings', () => {
    expect(withDefaults({ enabled: false, disabledSites: ['a.com'] })).toEqual({
      enabled: false,
      heuristics: true,
      categories: { ai: true, 'short-form': true, suggestions: true },
      disabledSites: ['a.com'],
    });
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('categories (ADR-008)', () => {
  it('are all on by default, and a missing entry means on', () => {
    expect(enabledCategories(DEFAULT_SETTINGS)).toEqual(['ai', 'short-form', 'suggestions']);
    const legacy: Settings = { enabled: true, heuristics: true, disabledSites: [] };
    expect(enabledCategories(legacy)).toEqual(['ai', 'short-form', 'suggestions']);
    expect(isCategoryEnabled(s({ categories: { ai: false } }), 'suggestions')).toBe(true);
  });

  it('setCategory changes one category and keeps the others', () => {
    const off = setCategory(DEFAULT_SETTINGS, 'short-form', false);
    expect(enabledCategories(off)).toEqual(['ai', 'suggestions']);
    expect(enabledCategories(setCategory(off, 'short-form', true))).toEqual([
      'ai',
      'short-form',
      'suggestions',
    ]);
  });

  it('heuristics only run while AI features are on', () => {
    expect(heuristicsEnabled(DEFAULT_SETTINGS)).toBe(true);
    expect(heuristicsEnabled(setCategory(DEFAULT_SETTINGS, 'ai', false))).toBe(false);
    expect(heuristicsEnabled(s({ heuristics: false }))).toBe(false);
  });

  it('withDefaults fills missing categories without dropping chosen ones', () => {
    expect(withDefaults({ enabled: true, categories: { suggestions: false } }).categories).toEqual({
      ai: true,
      'short-form': true,
      suggestions: false,
    });
  });
});
