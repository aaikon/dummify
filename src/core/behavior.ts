import { hostMatches } from './host';
import type { Category } from './rule';

/**
 * A site behavior: a small piece of DOM code for what CSS rules can't express, such as intercepting input that
 * would navigate into an algorithmic feed (ADR-007). Behaviors are the exception, and rules stay the norm.
 *
 * Constraints (checked in review and by tests):
 * - DOM only (no extension APIs), so they run unchanged in happy-dom tests.
 * - Cheap: event listeners only, never polling or full-page scans.
 * - Scoped: decide at event time (path, target) whether to act, so they stay correct in single-page apps.
 * - Reversible: `start()` returns a cleanup that removes everything it added.
 */
export interface Behavior {
  /** Stable `<site>.<behavior>` id. */
  readonly id: string;
  readonly description: string;
  /** Which switch this behavior follows, like Rule.category. */
  readonly category: Category;
  /** Host patterns, like Rule.hosts. See hostMatches. */
  readonly hosts: readonly string[];
  start(context: BehaviorContext): () => void;
}

export interface BehaviorContext {
  readonly doc: Document;
  readonly win: Window;
  /** The current URL path. A function so single-page navigations are seen at event time. */
  readonly path: () => string;
}

export function behaviorsForHost(behaviors: readonly Behavior[], host: string): Behavior[] {
  return behaviors.filter((b) => b.hosts.some((pattern) => hostMatches(host, pattern)));
}
