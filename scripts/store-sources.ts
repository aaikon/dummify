/**
 * What goes into the sources zip that Firefox Add-ons (AMO) reviewers rebuild the extension from (T-013).
 *
 * It's an allowlist on purpose: only what the build needs, plus the docs that explain it. Anything else in the
 * working folder (local notes, saved test pages under tests/) stays out, even if it isn't listed anywhere.
 * WXT also drops dotfiles and `*.test.ts` files from it. A test checks that every file the list matches is tracked
 * by git, so an untracked local file can never slip in.
 *
 * Add a path here when the build starts reading a new file outside these folders, then rebuild from the
 * sources zip (see README → "Store packages") to prove it still matches the uploaded extension.
 */
export const STORE_SOURCES = [
  'src/**',
  'public/**',
  'scripts/third-party-notices.ts',
  'scripts/store-sources.ts',
  'docs/**',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'wxt.config.ts',
  'README.md',
  'LICENSE',
  'PRIVACY.md',
];
