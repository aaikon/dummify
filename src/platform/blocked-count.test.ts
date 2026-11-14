import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { blockedCountItem, clearBlockedCount, handleBlockedCountMessage } from './blocked-count';

const msg = (count: number) => ({ type: 'dummify:blocked-count', count });

describe('blocked count (background)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('stores the top frame count per tab', async () => {
    await handleBlockedCountMessage(msg(3), { tab: { id: 7 }, frameId: 0 });
    await handleBlockedCountMessage(msg(1), { tab: { id: 8 }, frameId: 0 });
    expect(await blockedCountItem(7).getValue()).toBe(3);
    expect(await blockedCountItem(8).getValue()).toBe(1);
  });

  it('a new report replaces the old one (new page starts from its own total)', async () => {
    await handleBlockedCountMessage(msg(5), { tab: { id: 7 }, frameId: 0 });
    await handleBlockedCountMessage(msg(0), { tab: { id: 7 }, frameId: 0 });
    expect(await blockedCountItem(7).getValue()).toBe(0);
  });

  it('ignores subframes, senders without a tab, and malformed messages', async () => {
    await handleBlockedCountMessage(msg(4), { tab: { id: 7 }, frameId: 3 });
    await handleBlockedCountMessage(msg(4), { frameId: 0 });
    await handleBlockedCountMessage(
      { type: 'dummify:blocked-count', count: -2 },
      { tab: { id: 7 }, frameId: 0 },
    );
    expect(await blockedCountItem(7).getValue()).toBe(0);
  });

  it('clears a closed tab', async () => {
    await handleBlockedCountMessage(msg(2), { tab: { id: 7 }, frameId: 0 });
    await clearBlockedCount(7);
    expect(await blockedCountItem(7).getValue()).toBe(0);
  });

  it('mirrors the count on the toolbar badge for that tab', async () => {
    const badge = {
      setBadgeText: vi.fn(() => Promise.resolve()),
      setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
    };
    await handleBlockedCountMessage(msg(3), { tab: { id: 7 }, frameId: 0 }, badge);
    expect(badge.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: '3' });
    await handleBlockedCountMessage(msg(3), { tab: { id: 7 }, frameId: 2 }, badge);
    expect(badge.setBadgeText).toHaveBeenCalledTimes(1);
  });
});
