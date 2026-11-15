import type { Rule } from '@/core/rule';

/*
 * Google Search (google.<tld>, not subdomains such as mail.google.com).
 * Content kinds: AI features (AI Overview, AI Mode), automated suggestions (People also ask, related
 * searches, autocomplete; T-024; refinement chips, T-034), and short-form video (Short videos tab + carousel;
 * T-027).
 *
 * Results page structure (observed 2026-11, fixtures in tests/fixtures/google/):
 *
 *   [role="main"]
 *   ├─ div                     ← AI Overview block (header "AI Overview" / "AI-yhteenveto" + answer)
 *   │   └─ … #eKIzJc … [data-subtree="aimc"] …
 *   └─ div#center_col          ← organic results (#rso). Must never be hidden.
 *
 * Generated class names (e.g. "bzXtMb") change often, so the selectors use ids, data-subtree markers,
 * ARIA roles, and the AI Mode URL parameter (udm=50) instead.
 */

/** A direct child of the results column that does NOT hold the organic results. */
const MAIN_BLOCK = '[role="main"] > div:not(:has(#rso))';

/** Markers that are only present inside the AI Overview (absent on result pages without one). */
const AI_OVERVIEW_MARKERS = '[data-subtree="aimc"], #eKIzJc';

/** Links to the Short videos vertical (tab, and the carousel's "view all"). Regular Videos use udm=vids. */
const SHORT_VIDEOS_LINK = 'a[href*="udm=short_vids"]';

/**
 * A link to a YouTube Short (direct, or URL-encoded inside Google's /url redirect).
 * Only ever combined with a narrower scope (a video card, or a single result).
 */
const YOUTUBE_SHORT_LINK = 'a[href*="youtube.com/shorts/"], a[href*="youtube.com%2Fshorts%2F"]';

/**
 * The nearest per-result container: a video card, or the closest result block that doesn't hold a list of cards or
 * the whole results column. closest() picks the nearest ancestor matching any of these.
 */
const RESULT_CONTAINER = '[data-vid], [data-hveid]:not(:has([data-vid])):not(:has(#rso)):not(#rso)';

/** Links into AI Mode. `udm=50` selects AI Mode. Anchored to avoid matching e.g. `udm=500`. */
const AI_MODE_LINK = 'a[href*="udm=50&"], a[href$="udm=50"]';

export const googleRules: readonly Rule[] = [
  {
    id: 'google.ai-overview',
    category: 'ai',
    description: 'AI Overview block at the top of search results',
    hosts: ['google.*'],
    selectors: [
      // The whole block, header included.
      `${MAIN_BLOCK}:has(${AI_OVERVIEW_MARKERS})`,
      // Fallbacks if the block moves out from directly under [role="main"]: at least hide the answer itself.
      '#eKIzJc',
      '[data-subtree="aimc"]',
    ],
    anchors: [
      {
        // Fallback if the markers above disappear: find the block by its visible heading.
        selector: '[role="heading"]',
        labels: ['AI Overview', 'AI-yhteenveto'],
        container: MAIN_BLOCK,
      },
    ],
  },
  {
    id: 'google.ai-mode',
    category: 'ai',
    description: '"AI Mode" tab in the search navigation, and other links into AI Mode',
    hosts: ['google.*'],
    selectors: [`[role="listitem"]:has(${AI_MODE_LINK})`, AI_MODE_LINK],
  },
  {
    id: 'google.people-also-ask',
    category: 'suggestions',
    description: '"People also ask" question block in the results',
    hosts: ['google.*'],
    selectors: [
      // The whole block, header included. It's one child of #rso. Never one that holds an organic result: those
      // always have an <h3> title, while this block's headings are role="heading" spans.
      '#rso > div:has([data-initq]):not(:has(h3))',
      // Fallbacks if the block moves: its root (data-initq = the initial query) and its question items.
      '[data-initq]',
      '.related-question-pair',
    ],
  },
  {
    id: 'google.related-searches',
    category: 'suggestions',
    description: '"People also search for" / related searches at the bottom of the results',
    hosts: ['google.*'],
    // #bres is only the related-searches block. Pagination is a sibling outside it. Require links so an
    // empty placeholder isn't counted.
    selectors: ['#bres:has(a)'],
  },
  {
    id: 'google.refinement-chips',
    category: 'suggestions',
    description: 'Suggested search refinements ("To soft", "In pan", …) under the search tabs',
    hosts: ['google.*'],
    // The chip bar (#hdtb-sc) sits under the tabs. Each chip links to the search plus a refinement, carried in `uds`
    // ("Add To soft" / "Lisää …"). Only the chip list is hidden, never the bar: the tabs and the Tools button are
    // outside it. Both selectors stay inside #hdtb-sc, because after a refinement other links (e.g. tabs) can carry
    // `uds` too.
    selectors: [
      '#hdtb-sc [role="list"]:has(a[href*="uds="])',
      // Fallback if the list loses its role: each chip on its own.
      '#hdtb-sc [role="listitem"]:has(a[href*="uds="])',
    ],
  },
  {
    id: 'google.autocomplete',
    category: 'suggestions',
    description: 'Search suggestions dropdown under the search box',
    hosts: ['google.*'],
    selectors: [
      // The search textarea points at its suggestions container: aria-controls="Alh6id".
      '#Alh6id',
      // Fallback: any listbox inside the search form (the only listbox there is the suggestions).
      'form[role="search"] [role="listbox"]',
    ],
  },
  {
    id: 'google.short-videos',
    category: 'short-form',
    description:
      '"Short videos" tab, the short-videos carousel, Shorts in the Videos section, and Shorts results',
    hosts: ['google.*'],
    selectors: [
      `[role="listitem"]:has(${SHORT_VIDEOS_LINK})`,
      // The carousel: the #rso child holding the "view all short videos" link, never one with an organic result (h3).
      // Not matched by youtube.com/shorts/ links: the regular Videos carousel can contain those too.
      `#rso > div:has(${SHORT_VIDEOS_LINK}):not(:has(h3))`,
      SHORT_VIDEOS_LINK,
      // Individual Shorts, card by card (owner request): every video result is a [data-vid] card holding one
      // video. Covers the Videos section on the main page, the Videos tab (udm=vids), and Short results that are
      // cards. Only cards linking to youtube.com/shorts/ are hidden; their lists and other videos stay.
      // Not scoped to #rso: results loaded later while scrolling can be appended outside it.
      `[data-vid]:has(${YOUTUBE_SHORT_LINK})`,
      // Short results without a video card: a #rso child with a title and a Shorts link but NO [data-vid].
      // The :not(:has([data-vid])) guard matters: on the Videos tab ALL results share one #rso child, so without it
      // the whole list would hide.
      `#rso > div:has(${YOUTUBE_SHORT_LINK}):has(h3):not(:has([data-vid]))`,
    ],
    anchors: [
      {
        // Fallback if the "view all" link disappears: find the carousel by its heading.
        selector: '[role="heading"]',
        labels: ['Short videos', 'Lyhyet videot'],
        container: '#rso > div:not(:has(h3))',
      },
      {
        // The breadcrumb Google shows above Shorts results: "www.youtube.com › shorts" (owner's suggestion).
        // Independent of link format and of where the result sits (e.g. results appended while scrolling).
        selector: 'cite',
        labels: [/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com › shorts(?: › [\w-]+)?$/],
        container: RESULT_CONTAINER,
      },
    ],
  },
];
