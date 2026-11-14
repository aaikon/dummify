import '@/ui/tokens.css';
import '@/ui/components.css';
import './style.css';
import { hasAllSitesAccess, ONBOARDING_PATH, syncAccessBadge } from '@/platform/access';
import { blockedCountItem } from '@/platform/blocked-count';
import { settingsItem } from '@/platform/settings';
import { mountPopup } from '@/popup/popup';

const root = document.getElementById('app');
if (!root) throw new Error('popup: #app missing');

void mountPopup(root, {
  async getActiveTab() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab;
  },
  settings: settingsItem,
  countFor: blockedCountItem,
  access: {
    has: () => hasAllSitesAccess(browser.permissions),
    onChange(callback) {
      const recheck = () => void hasAllSitesAccess(browser.permissions).then(callback);
      browser.permissions.onAdded.addListener(recheck);
      browser.permissions.onRemoved.addListener(recheck);
      return () => {
        browser.permissions.onAdded.removeListener(recheck);
        browser.permissions.onRemoved.removeListener(recheck);
      };
    },
    syncBadge: () => void syncAccessBadge(browser.permissions, browser.action),
    openOnboarding() {
      void browser.tabs.create({ url: browser.runtime.getURL(ONBOARDING_PATH) });
      window.close();
    },
  },
});
