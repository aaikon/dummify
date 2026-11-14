import type { Rule } from '@/core/rule';

/*
 * YouTube (youtube.com and subdomains). Content kind: short-form video (Shorts; T-019, T-028).
 *
 * YouTube names its components semantically, so selectors use element names (stable across class churn):
 *
 *   ytd-item-section-renderer #contents        ← search results list (Shorts shelves sit BETWEEN normal results)
 *   ├─ grid-shelf-view-model                    ← a shelf; Shorts shelves contain Shorts tiles
 *   │   └─ ytm-shorts-lockup-view-model(-v2)    ← one Short tile
 *   └─ ytd-video-renderer                       ← a normal video result (must stay)
 *
 * Observed on the search page (fixture: tests/fixtures/youtube/search.fi.html). Selectors marked "unverified" come
 * from YouTube's known component names and are tested on simulated markup until real pages are saved.
 */

/** A link to a Short (relative on the live site, absolute in saved pages). Not the Shorts feed itself. */
const SHORT_LINK = 'a[href*="/shorts/"]';

/** The Shorts feed link in navigation (exactly /shorts/, not /shorts/<id>). */
const SHORTS_FEED_LINK = 'a[href="/shorts/"], a[href$="youtube.com/shorts/"]';

export const youtubeRules: readonly Rule[] = [
  {
    id: 'youtube.shorts-shelf',
    category: 'short-form',
    description: 'Shorts shelves (search, home, channel pages)',
    hosts: ['youtube.com'],
    selectors: [
      // Any shelf holding Shorts tiles. Normal-video shelves have no Shorts tiles, so they never match.
      'grid-shelf-view-model:has(ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2)',
      // Unverified: older and home-page Shorts shelves.
      'ytd-reel-shelf-renderer',
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
    ],
  },
  {
    id: 'youtube.shorts-item',
    category: 'short-form',
    description:
      'Individual Shorts anywhere on YouTube (tiles, search results, Up next, home grid, subscriptions)',
    hosts: ['youtube.com'],
    selectors: [
      'ytm-shorts-lockup-view-model',
      'ytm-shorts-lockup-view-model-v2',
      // Unverified: a Short rendered as an ordinary video item.
      `ytd-video-renderer:has(${SHORT_LINK})`,
      `ytd-rich-item-renderer:has(${SHORT_LINK})`,
      `ytd-compact-video-renderer:has(${SHORT_LINK})`,
      `ytd-grid-video-renderer:has(${SHORT_LINK})`,
      `yt-lockup-view-model:has(${SHORT_LINK})`,
    ],
  },
  {
    id: 'youtube.shorts-nav',
    category: 'short-form',
    description:
      'The "Shorts" entries in the side menus, the Shorts search filter chip, and the channel Shorts tab',
    hosts: ['youtube.com'],
    selectors: [
      `ytd-mini-guide-entry-renderer:has(${SHORTS_FEED_LINK})`,
      `ytd-guide-entry-renderer:has(${SHORTS_FEED_LINK})`,
      // Unverified: channel page tab.
      'yt-tab-shape[tab-title="Shorts"]',
    ],
    anchors: [
      {
        // The "Shorts" chip among the search filters ("Kaikki, Shorts, Videot, …").
        selector: 'yt-chip-cloud-chip-renderer',
        labels: ['Shorts'],
        container: 'yt-chip-cloud-chip-renderer',
      },
    ],
  },
  {
    id: 'youtube.shorts-feed',
    category: 'short-form',
    description:
      'On a /shorts/ page: the Next/Previous buttons, following Shorts, and the suggested-Shorts carousel (ADR-006)',
    hosts: ['youtube.com'],
    // The linked Short (the first reel) stays playable. Paired with the youtube.shorts-feed-lock behavior, which
    // blocks the wheel/keys that would advance (CSS can't stop those).
    selectors: [
      'ytd-shorts #navigation-button-up',
      'ytd-shorts #navigation-button-down',
      // Queued next Shorts. #shorts-inner-container holds div#initial-player-container, templates, then the reels
      // div#0 (the Short you opened, with its player) and div#1…#N (the feed), then div#overlay-initial-container.
      // Hide every reel except #0, and never the two player containers.
      '#shorts-inner-container > div:not([id="0"]):not(#initial-player-container):not(#overlay-initial-container)',
      // A carousel in the Short's info panel linking to other Shorts.
      'ytd-shorts yt-reel-carousel-view-model',
    ],
  },
];
