import { defineConfig } from 'wxt';
import { thirdPartyNotices } from './scripts/third-party-notices';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  hooks: {
    // Fonts (OFL) and bundled libraries (MIT) must ship with their licenses. See scripts/third-party-notices.ts.
    'build:publicAssets': (wxt, files) => {
      files.push({
        relativeDest: 'THIRD_PARTY_NOTICES.txt',
        contents: thirdPartyNotices(wxt.config.root),
      });
    },
  },
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'dummify',
    // ≤ 132 chars (Chrome Web Store limit). Tagline from the owner (T-018).
    description:
      'dummify takes the "smart" out of the web: hides AI answers, Shorts and Reels, and algorithmic suggestions.',
    // Product invariant: no network access. storage = settings; activeTab = read the current tab's URL when the
    // user opens the popup (Firefox withholds tab.url otherwise). See ADR-003.
    permissions: ['storage', 'activeTab'],
    // Declared so it can be checked and requested at runtime (Firefox treats MV3 host permissions as optional).
    // Adds no new install warning: the <all_urls> content script already implies it. See ADR-005.
    host_permissions: ['<all_urls>'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // Permanent AMO identity: never change after the first Firefox release (also required for storage.sync).
          id: '{c895a208-43a8-4125-a229-3bd263a910fa}',
          // Product invariant: we collect and transmit nothing.
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
