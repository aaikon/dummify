import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings';
import { ICON_PATHS, type IconDeps, iconStateFor, syncAllIcons, syncTabIcon } from './icon';

const s = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

describe('iconStateFor', () => {
  it('is active where dummify runs', () => {
    expect(iconStateFor(s(), 'https://www.google.com/search', true)).toBe('active');
  });

  it('is dim when the site is off, dummify is off everywhere, or site access is missing', () => {
    expect(
      iconStateFor(s({ disabledSites: ['google.com'] }), 'https://www.google.com/', true),
    ).toBe('dim');
    expect(iconStateFor(s({ enabled: false }), 'https://www.google.com/', true)).toBe('dim');
    expect(iconStateFor(s(), 'https://www.google.com/', false)).toBe('dim');
  });

  it('stays neutral (active) on browser pages and when the URL is withheld', () => {
    expect(iconStateFor(s(), 'about:addons', true)).toBe('active');
    expect(iconStateFor(s(), undefined, true)).toBe('active');
  });
});

describe('syncing icons', () => {
  const deps = (over: Partial<IconDeps> = {}) => {
    const setIcon = vi.fn(() => Promise.resolve());
    const d: IconDeps = {
      api: { setIcon },
      settings: () => Promise.resolve(s({ disabledSites: ['example.com'] })),
      hasAccess: () => Promise.resolve(true),
      tabs: () =>
        Promise.resolve([
          { id: 1, url: 'https://www.google.com/' },
          { id: 2, url: 'https://example.com/page' },
          { url: 'https://no-id.example/' },
        ]),
      ...over,
    };
    return { d, setIcon };
  };

  it('sets every tab, plus the global default, from settings', async () => {
    const { d, setIcon } = deps();
    await syncAllIcons(d);
    expect(setIcon).toHaveBeenCalledWith({ path: ICON_PATHS.active });
    expect(setIcon).toHaveBeenCalledWith({ tabId: 1, path: ICON_PATHS.active });
    expect(setIcon).toHaveBeenCalledWith({ tabId: 2, path: ICON_PATHS.dim });
    expect(setIcon).toHaveBeenCalledTimes(3); // the tab without an id is skipped
  });

  it('dims everything when site access is missing', async () => {
    const { d, setIcon } = deps({ hasAccess: () => Promise.resolve(false) });
    await syncAllIcons(d);
    for (const call of setIcon.mock.calls as unknown as [{ path: unknown }][]) {
      expect(call[0].path).toEqual(ICON_PATHS.dim);
    }
  });

  it('updates a single tab after it navigates', async () => {
    const { d, setIcon } = deps();
    await syncTabIcon(d, { id: 2, url: 'https://example.com/' });
    expect(setIcon).toHaveBeenCalledWith({ tabId: 2, path: ICON_PATHS.dim });
    await syncTabIcon(d, { url: 'https://example.com/' });
    expect(setIcon).toHaveBeenCalledTimes(1);
  });

  it('points at icon files that ship with the extension', () => {
    expect(Object.values(ICON_PATHS.active)).toContain('/icon/16.png');
    expect(Object.values(ICON_PATHS.dim)).toContain('/icon/dim-128.png');
  });
});
