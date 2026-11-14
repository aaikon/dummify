import { type BadgeApi, setAccessBadge } from './badge';

/**
 * Host access: dummify only works where the browser lets its content script run.
 *
 * - **Firefox** (MV3) treats host permissions as optional. Users may never grant them, or may revoke them.
 * - **Chrome** grants them at install, but users can restrict site access later.
 *
 * So both browsers check `<all_urls>` and guide the user through the onboarding page when it's missing (T-011).
 */
export const ALL_SITES = { origins: ['<all_urls>'] };

/** Path of the onboarding page (src/entrypoints/onboarding/). */
export const ONBOARDING_PATH = '/onboarding.html';

/** The subset of `browser.permissions` we use, injectable for tests. */
export interface PermissionsApi {
  contains(permissions: { origins: string[] }): Promise<boolean>;
  request(permissions: { origins: string[] }): Promise<boolean>;
}

export const hasAllSitesAccess = (api: PermissionsApi): Promise<boolean> => api.contains(ALL_SITES);

/** Must be called from a user gesture (a click handler) on an extension page. */
export const requestAllSitesAccess = (api: PermissionsApi): Promise<boolean> =>
  api.request(ALL_SITES);

export interface InstalledDeps {
  readonly permissions: PermissionsApi;
  openTab(url: string): Promise<unknown>;
  readonly onboardingUrl: string;
}

/** After a fresh install, open the onboarding page, but only if access is actually missing. */
export async function handleInstalled(
  details: { reason: string },
  deps: InstalledDeps,
): Promise<void> {
  if (details.reason !== 'install') return;
  if (await hasAllSitesAccess(deps.permissions)) return;
  await deps.openTab(deps.onboardingUrl);
}

/** Show the "!" badge while access is missing (docs/style-guide.md → Toolbar icon and badge). */
export async function syncAccessBadge(
  permissions: PermissionsApi,
  badge: BadgeApi,
): Promise<boolean> {
  const granted = await hasAllSitesAccess(permissions);
  await setAccessBadge(badge, !granted);
  return granted;
}
