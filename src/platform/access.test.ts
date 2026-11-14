import { describe, expect, it, vi } from 'vitest';
import {
  ALL_SITES,
  handleInstalled,
  type PermissionsApi,
  requestAllSitesAccess,
  syncAccessBadge,
} from './access';
import { BADGE_WARN_BACKGROUND } from './badge';

const permissions = (granted: boolean) =>
  ({
    contains: vi.fn(() => Promise.resolve(granted)),
    request: vi.fn(() => Promise.resolve(true)),
  }) satisfies PermissionsApi;
const badge = () => ({
  setBadgeText: vi.fn(() => Promise.resolve()),
  setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
  setBadgeTextColor: vi.fn(() => Promise.resolve()),
});

describe('handleInstalled', () => {
  const run = (reason: string, granted: boolean) => {
    const deps = {
      permissions: permissions(granted),
      openTab: vi.fn(() => Promise.resolve()),
      onboardingUrl: 'ext://onboarding.html',
    };
    return handleInstalled({ reason }, deps).then(() => deps);
  };

  it('opens onboarding after a fresh install when site access is missing (Firefox)', async () => {
    const deps = await run('install', false);
    expect(deps.permissions.contains).toHaveBeenCalledWith(ALL_SITES);
    expect(deps.openTab).toHaveBeenCalledWith('ext://onboarding.html');
  });

  it('stays quiet when access was granted at install (Chrome)', async () => {
    expect((await run('install', true)).openTab).not.toHaveBeenCalled();
  });

  it('never opens on updates or browser updates', async () => {
    expect((await run('update', false)).openTab).not.toHaveBeenCalled();
    expect((await run('browser_update', false)).openTab).not.toHaveBeenCalled();
  });
});

describe('access requests and badge', () => {
  it('requests <all_urls>', async () => {
    const api = permissions(false);
    await requestAllSitesAccess(api);
    expect(api.request).toHaveBeenCalledWith({ origins: ['<all_urls>'] });
  });

  it('shows a global "!" badge while access is missing', async () => {
    const b = badge();
    expect(await syncAccessBadge(permissions(false), b)).toBe(false);
    expect(b.setBadgeText).toHaveBeenCalledWith({ text: '!' });
    expect(b.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: BADGE_WARN_BACKGROUND });
  });

  it('clears the global badge once access is granted', async () => {
    const b = badge();
    expect(await syncAccessBadge(permissions(true), b)).toBe(true);
    expect(b.setBadgeText).toHaveBeenCalledWith({ text: '' });
    expect(b.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });
});
