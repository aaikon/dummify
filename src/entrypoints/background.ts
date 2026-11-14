import {
  handleInstalled,
  hasAllSitesAccess,
  ONBOARDING_PATH,
  syncAccessBadge,
} from '@/platform/access';
import { clearBlockedCount, handleBlockedCountMessage } from '@/platform/blocked-count';
import { type IconDeps, syncAllIcons, syncTabIcon } from '@/platform/icon';
import { settingsItem } from '@/platform/settings';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    void handleBlockedCountMessage(message, sender, browser.action);
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void clearBlockedCount(tabId);
  });

  // Site access (T-011): onboarding after install, "!" badge while access is missing.
  browser.runtime.onInstalled.addListener((details) => {
    void handleInstalled(details, {
      permissions: browser.permissions,
      openTab: (url) => browser.tabs.create({ url }),
      onboardingUrl: browser.runtime.getURL(ONBOARDING_PATH),
    });
  });
  // Toolbar icon states (T-029): dim where dummify is off or lacks access.
  const icons: IconDeps = {
    api: browser.action,
    settings: () => settingsItem.getValue(),
    hasAccess: () => hasAllSitesAccess(browser.permissions),
    tabs: () => browser.tabs.query({}),
  };
  const sync = () => {
    void syncAccessBadge(browser.permissions, browser.action);
    void syncAllIcons(icons);
  };
  browser.permissions.onAdded.addListener(sync);
  browser.permissions.onRemoved.addListener(sync);
  settingsItem.watch(() => void syncAllIcons(icons));
  browser.tabs.onUpdated.addListener((_tabId, change, tab) => {
    if (change.url !== undefined || change.status === 'loading') void syncTabIcon(icons, tab);
  });
  sync(); // every service-worker start
});
