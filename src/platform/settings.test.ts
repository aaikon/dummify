import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS } from '@/core/settings';
import { settingsItem } from './settings';

describe('settingsItem', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('falls back to defaults when nothing is stored', async () => {
    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS);
  });

  it('migrates v1 settings (no heuristics field) and keeps the user values', async () => {
    // What a v1 install left in storage.sync: the value plus WXT's version metadata.
    await fakeBrowser.storage.sync.set({
      settings: { enabled: false, disabledSites: ['example.com'] },
      settings$: { v: 1 },
    });
    await settingsItem.migrate();
    expect(await settingsItem.getValue()).toEqual({
      enabled: false,
      heuristics: true,
      categories: { ai: true, 'short-form': true, suggestions: true },
      disabledSites: ['example.com'],
    });
  });

  it('migrates v2 settings (no categories) to v3 with every category on', async () => {
    await fakeBrowser.storage.sync.set({
      settings: { enabled: true, heuristics: false, disabledSites: ['a.com'] },
      settings$: { v: 2 },
    });
    await settingsItem.migrate();
    expect(await settingsItem.getValue()).toEqual({
      enabled: true,
      heuristics: false,
      categories: { ai: true, 'short-form': true, suggestions: true },
      disabledSites: ['a.com'],
    });
  });
});
