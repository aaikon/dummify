import { normalizeHost } from '@/core/host';
import { isBlockingActive, type Settings } from '@/core/settings';

/**
 * Toolbar icon states (docs/style-guide.md → Toolbar icon and badge; T-029):
 * - `active`: dummify runs on this tab (or the page is a browser page it can't run on: neutral, not "off").
 * - `dim`: dummify is off for this site or everywhere, or it lacks site access (paired with the "!" badge).
 */
export type IconState = 'active' | 'dim';

const SIZES = [16, 32, 48, 96, 128] as const;
const paths = (prefix: string): Record<string, string> =>
  Object.fromEntries(SIZES.map((s) => [String(s), `/icon/${prefix}${String(s)}.png`]));

export const ICON_PATHS: Record<IconState, Record<string, string>> = {
  active: paths(''),
  dim: paths('dim-'),
};

/** The subset of `browser.action` used here, injectable for tests. */
export interface IconApi {
  setIcon(details: { tabId?: number; path: Record<string, string> }): Promise<void>;
}

export interface TabLike {
  readonly id?: number | undefined;
  readonly url?: string | undefined;
}

export function iconStateFor(
  settings: Settings,
  url: string | undefined,
  hasAccess: boolean,
): IconState {
  if (!hasAccess) return 'dim';
  const host = url ? normalizeHost(url) : null;
  if (host === null) return 'active';
  return isBlockingActive(settings, host) ? 'active' : 'dim';
}

export interface IconDeps {
  readonly api: IconApi;
  settings(): Promise<Settings>;
  hasAccess(): Promise<boolean>;
  tabs(): Promise<readonly TabLike[]>;
}

/** Update one tab's icon (after it navigates). */
export async function syncTabIcon(deps: IconDeps, tab: TabLike): Promise<void> {
  if (tab.id === undefined) return;
  const [settings, access] = await Promise.all([deps.settings(), deps.hasAccess()]);
  await deps.api.setIcon({
    tabId: tab.id,
    path: ICON_PATHS[iconStateFor(settings, tab.url, access)],
  });
}

/** Update the global default and every open tab (after settings or access change). */
export async function syncAllIcons(deps: IconDeps): Promise<void> {
  const [settings, access, tabs] = await Promise.all([
    deps.settings(),
    deps.hasAccess(),
    deps.tabs(),
  ]);
  await deps.api.setIcon({ path: ICON_PATHS[access ? 'active' : 'dim'] });
  await Promise.all(
    tabs.flatMap((t) =>
      t.id === undefined
        ? []
        : [
            deps.api.setIcon({
              tabId: t.id,
              path: ICON_PATHS[iconStateFor(settings, t.url, access)],
            }),
          ],
    ),
  );
}
