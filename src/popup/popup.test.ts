import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, type Settings } from '@/core/settings';
import { blockedCountItem } from '@/platform/blocked-count';
import { settingsItem } from '@/platform/settings';
import componentsCss from '@/ui/components.css?raw';
import popupCss from '../entrypoints/popup/style.css?raw';
import { flush, isHidden } from '../../tests/helpers/dom';
import { mountPopup, type ActiveTab, type PopupDeps } from './popup';
import { strings } from './strings';

const TAB_ID = 42;
let root: HTMLElement;
let unmount: (() => void) | undefined;

async function open(tab: ActiveTab | undefined, extra: Partial<PopupDeps> = {}): Promise<void> {
  root = document.createElement('div');
  document.body.replaceChildren(root);
  unmount = await mountPopup(root, {
    getActiveTab: () => Promise.resolve(tab),
    settings: settingsItem,
    countFor: blockedCountItem,
    ...extra,
  });
}
const onPage = (url = 'https://www.example.com/page') => open({ id: TAB_ID, url });

const q = (selector: string): HTMLElement => {
  const el = root.querySelector(selector);
  if (!(el instanceof HTMLElement)) throw new Error(`popup has no ${selector}`);
  return el;
};
const input = (selector: string): HTMLInputElement => {
  const el = q(selector);
  if (!(el instanceof HTMLInputElement)) throw new Error(`${selector} is not an input`);
  return el;
};
const siteSwitch = () => input('#site-enabled');
const everywhereSwitch = () => input('#on-everywhere');
const status = () => q('[data-testid="status"]');
const countText = () => q('[data-testid="count"]').textContent;
const stored = () => settingsItem.getValue();
const toggle = async (input: HTMLInputElement) => {
  input.click(); // fires change, like a real click on the label/switch
  await flush();
};
const setSettings = (patch: Partial<Settings>) =>
  settingsItem.setValue({ ...DEFAULT_SETTINGS, ...patch });

beforeEach(() => {
  fakeBrowser.reset();
});
afterEach(() => {
  unmount?.();
  unmount = undefined;
});

describe('popup: current site', () => {
  it('shows the normalized host, an active status, and the site switch on', async () => {
    await onPage();
    expect(q('.host').textContent).toBe('example.com');
    expect(status().dataset.state).toBe('active');
    expect(status().textContent).toBe(strings.statusActive);
    expect(siteSwitch().checked).toBe(true);
    expect(countText()).toBe(strings.nothingHidden);
  });

  it('shows the blocked count for the tab, and updates it live', async () => {
    await blockedCountItem(TAB_ID).setValue(3);
    await onPage();
    expect(countText()).toBe(`3${strings.hiddenOnPage}`);

    await blockedCountItem(TAB_ID).setValue(5);
    await flush();
    expect(q('.count-num').textContent).toBe('5');
  });

  it('ignores counts from other tabs', async () => {
    await onPage();
    await blockedCountItem(7).setValue(9);
    await flush();
    expect(countText()).toBe(strings.nothingHidden);
  });

  it('turning the site switch off disables the site and shows it', async () => {
    await blockedCountItem(TAB_ID).setValue(3);
    await onPage();
    await toggle(siteSwitch());
    expect((await stored()).disabledSites).toEqual(['example.com']);
    expect(status().dataset.state).toBe('off-site');
    expect(status().textContent).toBe(strings.statusOffSite);
    expect(countText()).toBe(strings.nothingHidden);
  });

  it('turning it back on re-enables the site, including a disabled parent domain', async () => {
    await setSettings({ disabledSites: ['example.com', 'other.org'] });
    await onPage('https://docs.example.com/');
    expect(siteSwitch().checked).toBe(false);
    await toggle(siteSwitch());
    expect((await stored()).disabledSites).toEqual(['other.org']);
    expect(status().dataset.state).toBe('active');
  });

  it('reflects setting changes made elsewhere (another popup or device) live', async () => {
    await onPage();
    await setSettings({ disabledSites: ['example.com'] });
    await flush();
    expect(siteSwitch().checked).toBe(false);
  });

  it('says it cannot run on browser pages, and has no site switch', async () => {
    await open({ id: TAB_ID, url: 'chrome://extensions/' });
    expect(q('[data-testid="unsupported"]').textContent).toBe(strings.unsupported);
    expect(root.querySelector('#site-enabled')).toBeNull();
  });

  it('says it has no access when the browser withholds the tab URL', async () => {
    await open({ id: TAB_ID });
    expect(q('[data-testid="unsupported"]').textContent).toBe(strings.noAccess);
    expect(root.querySelector('#site-enabled')).toBeNull();
  });

  it('treats a missing tab as a page it cannot run on', async () => {
    await open(undefined);
    expect(q('[data-testid="unsupported"]').textContent).toBe(strings.unsupported);
  });
});

describe('popup: global settings', () => {
  it('the "on everywhere" switch persists and is reflected in the status', async () => {
    await onPage();
    expect(everywhereSwitch().checked).toBe(true);
    await toggle(everywhereSwitch());
    expect((await stored()).enabled).toBe(false);
    expect(status().dataset.state).toBe('off-everywhere');
    expect(status().textContent).toBe(strings.statusOffEverywhere);
    // The site's own preference is kept and still shown.
    expect(siteSwitch().checked).toBe(true);
  });

  it('keeps unrelated settings when writing', async () => {
    await setSettings({ heuristics: false, disabledSites: ['a.com'] });
    await onPage();
    await toggle(everywhereSwitch());
    expect(await stored()).toEqual({
      enabled: false,
      heuristics: false,
      categories: { ai: true, 'short-form': true, suggestions: true },
      disabledSites: ['a.com'],
    });
  });

  it('hides the heuristics switch when the feature is unavailable', async () => {
    await open({ id: TAB_ID, url: 'https://example.com/' }, { features: { heuristics: false } });
    expect(root.querySelector('#heuristics')).toBeNull();
  });

  it('shows and persists the heuristics switch (shipped in T-009)', async () => {
    await onPage();
    const heuristics = input('#heuristics');
    expect(heuristics.checked).toBe(true);
    await toggle(heuristics);
    expect((await stored()).heuristics).toBe(false);
  });
});

describe('popup: accessibility', () => {
  it('every switch is a labelled role=switch checkbox', async () => {
    await onPage();
    const switches = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(switches.length).toBe(6); // site, 3 categories, on everywhere, heuristics
    for (const input of switches) {
      expect(input.getAttribute('role')).toBe('switch');
      const label = root.querySelector(`label[for="${input.id}"]`);
      expect(label?.textContent.trim().length, input.id).toBeGreaterThan(0);
      expect(label?.contains(input)).toBe(true);
    }
  });

  it('announces count changes politely', async () => {
    await onPage();
    expect(q('[data-testid="count"]').getAttribute('aria-live')).toBe('polite');
  });

  it('never conveys status by color alone (status always has text)', async () => {
    await onPage();
    for (const patch of [{}, { disabledSites: ['example.com'] }, { enabled: false }]) {
      await setSettings(patch);
      await flush();
      expect(status().textContent.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('popup: unmount', () => {
  it('stops listening to storage', async () => {
    await onPage();
    unmount?.();
    unmount = undefined;
    await setSettings({ enabled: false });
    await flush();
    expect(everywhereSwitch().checked).toBe(true);
  });
});

describe('popup: site access banner (T-011)', () => {
  const banner = () => q('[data-testid="access-banner"]');
  const access = (granted: boolean) => {
    let notify: (granted: boolean) => void = () => undefined;
    const api = {
      has: () => Promise.resolve(granted),
      onChange: (cb: (granted: boolean) => void) => {
        notify = cb;
        return () => undefined;
      },
      openOnboarding: vi.fn(),
    };
    return {
      api,
      notify: (g: boolean) => {
        notify(g);
      },
    };
  };

  it('is hidden when dummify has access', async () => {
    await open({ id: TAB_ID, url: 'https://example.com/' }, { access: access(true).api });
    expect(banner().hidden).toBe(true);
  });

  it('shows a warning with one action when access is missing', async () => {
    const a = access(false);
    await open({ id: TAB_ID, url: 'https://example.com/' }, { access: a.api });
    expect(banner().hidden).toBe(false);
    expect(banner().textContent).toContain(strings.accessMissing);
    expect(banner().querySelectorAll('button')).toHaveLength(1);
    expect(banner().querySelector('[role="alert"]')).not.toBeNull();
  });

  it('Allow opens the onboarding page (not an in-popup prompt)', async () => {
    const a = access(false);
    await open({ id: TAB_ID, url: 'https://example.com/' }, { access: a.api });
    banner().querySelector('button')?.click();
    expect(a.api.openOnboarding).toHaveBeenCalledTimes(1);
  });

  it('syncs the toolbar badge on open and when access changes (regression: badge stayed "!")', async () => {
    const a = access(false);
    const syncBadge = vi.fn();
    await open({ id: TAB_ID, url: 'https://example.com/' }, { access: { ...a.api, syncBadge } });
    expect(syncBadge).toHaveBeenCalledTimes(1);
    a.notify(true);
    expect(syncBadge).toHaveBeenCalledTimes(2);
  });

  it('disappears live once access is granted', async () => {
    const a = access(false);
    await open({ id: TAB_ID, url: 'https://example.com/' }, { access: a.api });
    a.notify(true);
    expect(banner().hidden).toBe(true);
  });

  it('is hidden when no access info is available', async () => {
    await onPage();
    expect(banner().hidden).toBe(true);
  });
});

describe('popup: real stylesheet (regression: [hidden] overridden by component CSS)', () => {
  /** Load the shipped popup CSS so assertions check what is actually displayed, not just the attribute. */
  const withRealCss = () => {
    const style = document.createElement('style');
    style.textContent = `${componentsCss}\n${popupCss}`;
    document.head.append(style);
    return () => {
      style.remove();
    };
  };

  it('the access banner is not displayed when dummify has access', async () => {
    const cleanup = withRealCss();
    await open(
      { id: TAB_ID, url: 'https://example.com/' },
      {
        access: {
          has: () => Promise.resolve(true),
          onChange: () => () => undefined,
          openOnboarding: () => undefined,
        },
      },
    );
    expect(isHidden(q('[data-testid="access-banner"]'))).toBe(true);
    cleanup();
  });

  it('the access banner is displayed when access is missing', async () => {
    const cleanup = withRealCss();
    await open(
      { id: TAB_ID, url: 'https://example.com/' },
      {
        access: {
          has: () => Promise.resolve(false),
          onChange: () => () => undefined,
          openOnboarding: () => undefined,
        },
      },
    );
    expect(isHidden(q('[data-testid="access-banner"]'))).toBe(false);
    cleanup();
  });

  it('the zero count number is not displayed', async () => {
    const cleanup = withRealCss();
    await onPage();
    expect(isHidden(q('.count-num'))).toBe(true);
    cleanup();
  });
});

describe('popup: what to hide (T-030)', () => {
  const cat = (c: string) => input(`#category-${c}`);

  it('shows the three category switches, all on by default', async () => {
    await onPage();
    expect(q('#what-to-hide').textContent).toBe(strings.whatToHide);
    for (const c of ['ai', 'short-form', 'suggestions']) expect(cat(c).checked, c).toBe(true);
  });

  it('turning a category off persists only that category', async () => {
    await onPage();
    await toggle(cat('short-form'));
    expect((await stored()).categories).toEqual({
      ai: true,
      'short-form': false,
      suggestions: true,
    });
    await toggle(cat('short-form'));
    expect((await stored()).categories).toEqual({
      ai: true,
      'short-form': true,
      suggestions: true,
    });
  });

  it('greys out "Detect AI on other sites" while AI features are off', async () => {
    await onPage();
    expect(input('#heuristics').disabled).toBe(false);
    await toggle(cat('ai'));
    expect(input('#heuristics').disabled).toBe(true);
    await toggle(cat('ai'));
    expect(input('#heuristics').disabled).toBe(false);
  });

  it('reflects category changes made elsewhere, live', async () => {
    await onPage();
    await setSettings({ categories: { suggestions: false } });
    await flush();
    expect(cat('suggestions').checked).toBe(false);
    expect(cat('ai').checked).toBe(true);
  });
});
