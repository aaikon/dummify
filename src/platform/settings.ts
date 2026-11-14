import { DEFAULT_SETTINGS, type Settings, withDefaults } from '@/core/settings';

/**
 * Synced across the user's browsers. Changes fire `watch` in every open tab and in the popup.
 * v2 added `heuristics`, v3 added `categories`. Migrations fill new fields from the defaults (everything on).
 */
export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 3,
  migrations: {
    // v2 added `heuristics`, v3 added per-category `categories` (ADR-008). withDefaults fills both, all on.
    2: (old: Partial<Settings> | null) => withDefaults(old),
    3: (old: Partial<Settings> | null) => withDefaults(old),
  },
});
