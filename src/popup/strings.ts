/**
 * Every user-facing popup string, in one place so the i18n pass can swap this module for `browser.i18n`
 * lookups. Copy rules: docs/style-guide.md → Voice and copy.
 */
export const strings = {
  hideOnSite: 'dummify this site',
  onEverywhere: 'On everywhere',
  onEverywhereHint: 'Turn off to pause dummify on every site.',
  whatToHide: 'What to hide',
  categories: {
    ai: { label: 'AI features', hint: 'AI answers, “Ask AI” buttons, AI widgets' },
    'short-form': { label: 'Short-form video', hint: 'Shorts and Reels' },
    suggestions: { label: 'Suggestions', hint: '“People also ask”, autocomplete, autoplay feeds' },
  },
  heuristics: 'Detect AI on other sites',
  heuristicsHint: 'Look for AI widgets on sites without a dedicated rule.',
  statusActive: 'Active',
  statusOffSite: 'Off on this site',
  statusOffEverywhere: 'Off everywhere',
  unsupported: 'dummify can’t run on this page.',
  noAccess: 'dummify doesn’t have access to this page.',
  accessMissing: 'dummify needs access to all sites to work.',
  accessAllow: 'Allow',
  nothingHidden: 'Nothing hidden on this page',
  hiddenOnPage: 'hidden on this page',
} as const;
