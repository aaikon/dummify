import type { Behavior } from '@/core/behavior';
import { youtubeShortsFeed } from './youtube-shorts-feed';

/** Every site behavior dummify ships (ADR-007). Keep this list short: prefer CSS rules whenever possible. */
export const ALL_BEHAVIORS: readonly Behavior[] = [youtubeShortsFeed];
