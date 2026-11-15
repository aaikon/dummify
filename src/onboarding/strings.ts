/**
 * Onboarding page copy. Rules: docs/style-guide.md → Voice and copy. Tagline: docs/store-listing.md.
 * Privacy claims must stay true to the product invariants (no network, no data collection).
 */
export const strings = {
  tagline: 'dummify takes the “smart” out of the web.',
  missingTitle: 'One step left',
  missingBody:
    'dummify hides AI answers, YouTube Shorts, and algorithmic suggestions by quietly adjusting the pages you visit. To do that, your browser needs to let it run on all sites.',
  privacy: 'dummify doesn’t collect or send anything. Nothing leaves your browser.',
  allow: 'Allow access to all sites',
  denied: 'Access wasn’t granted, so dummify can’t hide anything yet. You can try again anytime.',
  hidesTitle: 'What dummify hides',
  hides: [
    'AI answers, “Ask AI” buttons and AI chat widgets',
    'Shorts on YouTube and Google',
    'Search suggestions, like “People also ask” and autocomplete',
  ],
  grantedTitle: 'You’re all set',
  pinHint:
    'Tip: pin dummify to your toolbar (the puzzle-piece Extensions button) to see what it hides on each page.',
  grantedBody: 'dummify is now active on every site. You can close this tab.',
} as const;
