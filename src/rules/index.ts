import type { Rule } from '@/core/rule';
import { googleRules } from './google';
import { youtubeRules } from './youtube';

/**
 * Every rule dummify ships. Add one file per site/platform (e.g. `./google.ts`) and spread it here.
 * Each file's header comment states which kinds of content it covers: AI features, short-form video, or
 * automated suggestions. There are no per-kind settings; everything follows the one switch (ADR-004).
 * `rules.test.ts` validates every entry (unique ids, parseable selectors, non-empty hosts).
 */
export const ALL_RULES: readonly Rule[] = [...googleRules, ...youtubeRules];
