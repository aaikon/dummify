/**
 * The subset of `browser.action` we use, injectable so tests don't need a real toolbar.
 * Without `tabId` a call sets the global default; per-tab values override it for their tab.
 */
export interface BadgeApi {
  setBadgeText(details: { tabId?: number; text: string }): Promise<void>;
  setBadgeBackgroundColor(details: { tabId?: number; color: string }): Promise<void>;
  setBadgeTextColor?(details: { tabId?: number; color: string }): Promise<void>;
}

/** docs/style-guide.md → Toolbar icon and badge. Count: brand Ink on Crash Yellow (11.8:1), matching the icon. */
export const BADGE_BACKGROUND = '#ffc400';
export const BADGE_TEXT = '#111111';
/** "!" while site access is missing: white on the warning color (ink would be too dark on it). */
export const BADGE_WARN_BACKGROUND = '#9a3f0c';
export const BADGE_WARN_TEXT = '#ffffff';

/** Empty for zero (no badge), capped at "99+" so it fits the toolbar. */
export function badgeText(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

export async function updateBadge(api: BadgeApi, tabId: number, count: number): Promise<void> {
  const text = badgeText(count);
  await api.setBadgeText({ tabId, text });
  if (text === '') return;
  await api.setBadgeBackgroundColor({ tabId, color: BADGE_BACKGROUND });
  // Not available in every browser version. The browser then picks a readable default.
  await api.setBadgeTextColor?.({ tabId, color: BADGE_TEXT });
}

/**
 * Global "!" badge while dummify lacks site access. Content scripts can't run then, so no tab reports a count
 * that would cover it. When access returns, the global badge is cleared.
 */
export async function setAccessBadge(api: BadgeApi, missing: boolean): Promise<void> {
  await api.setBadgeText({ text: missing ? '!' : '' });
  if (!missing) return;
  await api.setBadgeBackgroundColor({ color: BADGE_WARN_BACKGROUND });
  await api.setBadgeTextColor?.({ color: BADGE_WARN_TEXT });
}
