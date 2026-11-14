import { describe, expect, it, vi } from 'vitest';
import {
  BADGE_BACKGROUND,
  BADGE_TEXT,
  BADGE_WARN_BACKGROUND,
  BADGE_WARN_TEXT,
  type BadgeApi,
  badgeText,
  setAccessBadge,
  updateBadge,
} from './badge';

const fakeApi = (withTextColor = true) => {
  const api = {
    setBadgeText: vi.fn(() => Promise.resolve()),
    setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
    ...(withTextColor && { setBadgeTextColor: vi.fn(() => Promise.resolve()) }),
  };
  return api satisfies BadgeApi;
};

describe('badgeText', () => {
  it.each([
    [0, ''],
    [-1, ''],
    [1, '1'],
    [99, '99'],
    [100, '99+'],
    [12345, '99+'],
  ])('%i → %j', (count, text) => {
    expect(badgeText(count)).toBe(text);
  });
});

describe('updateBadge', () => {
  it('sets per-tab text and the style-guide colors', async () => {
    const api = fakeApi();
    await updateBadge(api, 3, 4);
    expect(api.setBadgeText).toHaveBeenCalledWith({ tabId: 3, text: '4' });
    expect(api.setBadgeBackgroundColor).toHaveBeenCalledWith({ tabId: 3, color: BADGE_BACKGROUND });
    expect(api.setBadgeTextColor).toHaveBeenCalledWith({ tabId: 3, color: BADGE_TEXT });
  });

  it('clears the badge at zero without touching colors', async () => {
    const api = fakeApi();
    await updateBadge(api, 3, 0);
    expect(api.setBadgeText).toHaveBeenCalledWith({ tabId: 3, text: '' });
    expect(api.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });

  it('works in browsers without setBadgeTextColor', async () => {
    const api = fakeApi(false);
    await expect(updateBadge(api, 3, 2)).resolves.toBeUndefined();
  });
});

describe('setAccessBadge', () => {
  it('sets a global (not per-tab) "!" in the warning color', async () => {
    const api = fakeApi();
    await setAccessBadge(api, true);
    expect(api.setBadgeText).toHaveBeenCalledWith({ text: '!' });
    expect(api.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: BADGE_WARN_BACKGROUND });
    expect(api.setBadgeTextColor).toHaveBeenCalledWith({ color: BADGE_WARN_TEXT });
  });

  it('clears it', async () => {
    const api = fakeApi();
    await setAccessBadge(api, false);
    expect(api.setBadgeText).toHaveBeenCalledWith({ text: '' });
    expect(api.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });
});
