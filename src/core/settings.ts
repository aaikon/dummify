import { type Category, CATEGORIES } from './rule';

/** User settings, persisted in `browser.storage.sync` (see src/platform/settings.ts). */
export interface Settings {
  /** Master switch. */
  readonly enabled: boolean;
  /** Generic heuristics on unlisted sites (T-009). Part of the AI category: off whenever AI features are off. */
  readonly heuristics: boolean;
  /** Per-category switches (ADR-008). A missing entry means on, so older or partial settings never hide less. */
  readonly categories?: Readonly<Partial<Record<Category, boolean>>>;
  /** Normalized hosts (see normalizeHost) where the user turned blocking off. Covers their subdomains too. */
  readonly disabledSites: readonly string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  heuristics: true,
  categories: { ai: true, 'short-form': true, suggestions: true },
  disabledSites: [],
};

export function isCategoryEnabled(settings: Settings, category: Category): boolean {
  return settings.categories?.[category] ?? true;
}

export function enabledCategories(settings: Settings): Category[] {
  return CATEGORIES.filter((c) => isCategoryEnabled(settings, c));
}

/** Heuristics only run while the AI category is on, too. */
export function heuristicsEnabled(settings: Settings): boolean {
  return settings.heuristics && isCategoryEnabled(settings, 'ai');
}

export function setCategory(settings: Settings, category: Category, on: boolean): Settings {
  return {
    ...settings,
    categories: { ...DEFAULT_SETTINGS.categories, ...settings.categories, [category]: on },
  };
}

const covers = (site: string, host: string): boolean => host === site || host.endsWith(`.${site}`);

/** True if the user turned dummify off for `host` (directly or via a parent domain). Ignores the master switch. */
export function isSiteDisabled(settings: Settings, host: string): boolean {
  return settings.disabledSites.some((site) => covers(site, host));
}

/** Whether blocking should run on `host` under `settings`. */
export function isBlockingActive(settings: Settings, host: string): boolean {
  return settings.enabled && !isSiteDisabled(settings, host);
}

/**
 * Turn dummify on or off for `host`.
 * - **Off:** adds `host` unless it's already covered by itself or a parent entry.
 * - **On:** removes every entry covering `host`, including a parent domain, because otherwise the switch
 *   couldn't turn on. That re-enables the parent's other subdomains too, which matches what the user sees.
 */
export function setSiteEnabled(settings: Settings, host: string, enabled: boolean): Settings {
  if (enabled) {
    return {
      ...settings,
      disabledSites: settings.disabledSites.filter((site) => !covers(site, host)),
    };
  }
  if (isSiteDisabled(settings, host)) return settings;
  return { ...settings, disabledSites: [...settings.disabledSites, host].sort() };
}

/** Fill in fields added after a user's settings were first stored. */
export function withDefaults(stored: Partial<Settings> | null | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    categories: { ...DEFAULT_SETTINGS.categories, ...stored?.categories },
  };
}
