import '@/ui/tokens.css';
import '@/ui/components.css';
import './style.css';
import { mountOnboarding } from '@/onboarding/onboarding';
import { hasAllSitesAccess, requestAllSitesAccess, syncAccessBadge } from '@/platform/access';

const root = document.getElementById('app');
if (!root) throw new Error('onboarding: #app missing');

void mountOnboarding(root, {
  has: () => hasAllSitesAccess(browser.permissions),
  request: () => requestAllSitesAccess(browser.permissions),
  syncBadge: () => void syncAccessBadge(browser.permissions, browser.action),
  onChange(callback) {
    const recheck = () => void hasAllSitesAccess(browser.permissions).then(callback);
    browser.permissions.onAdded.addListener(recheck);
    browser.permissions.onRemoved.addListener(recheck);
    return () => {
      browser.permissions.onAdded.removeListener(recheck);
      browser.permissions.onRemoved.removeListener(recheck);
    };
  },
});
