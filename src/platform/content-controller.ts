import { type Behavior, behaviorsForHost } from '@/core/behavior';
import { createBlocker } from '@/core/engine';
import { FEATURES, type Features } from '@/core/features';
import { isHeuristicsExcludedHost } from '@/core/heuristics';
import { normalizeHost } from '@/core/host';
import { type Category, CATEGORIES, type Rule, rulesForHost } from '@/core/rule';
import {
  DEFAULT_SETTINGS,
  enabledCategories,
  heuristicsEnabled,
  isBlockingActive,
  type Settings,
  withDefaults,
} from '@/core/settings';
import { settingsItem } from './settings';

export interface ContentControllerOptions {
  readonly doc: Document;
  readonly url: string;
  readonly rules: readonly Rule[];
  /** Receives the blocked count. Coalesced to at most one call per `reportIntervalMs`. */
  readonly report: (count: number) => void;
  readonly reportIntervalMs?: number;
  readonly features?: Features;
  /** Site behaviors (ADR-007). They run while blocking is active on this host, like the rules. */
  readonly behaviors?: readonly Behavior[];
  /** Current URL path, read at event time by behaviors (single-page apps). Injectable for tests. */
  readonly path?: () => string;
}

/**
 * Connects the blocker to the user's settings for one document.
 * Returns a dispose function, or `null` when there's nothing to do on this page.
 *
 * Runs when the host has site rules, or when heuristics are available here (FEATURES.heuristics and not an
 * AI-product host). Blocking starts **before** settings load (no-flash invariant), using the default settings.
 * If the site, or heuristics, turn out to be disabled, hidden elements reappear a moment later. That's the right tradeoff: AI content never flashes on, and
 * opted-out sites only see a short delay.
 */
export function startContentController({
  doc,
  url,
  rules,
  report,
  reportIntervalMs = 250,
  features = FEATURES,
  behaviors = [],
  path = () => doc.defaultView?.location.pathname ?? '',
}: ContentControllerOptions): (() => void) | null {
  const host = normalizeHost(url);
  if (host === null) return null;
  const siteRules = rulesForHost(rules, host);
  const siteBehaviors = behaviorsForHost(behaviors, host);
  // Heuristics run on every site except AI products themselves (the user went there on purpose).
  const heuristicsAllowed = features.heuristics && !isHeuristicsExcludedHost(host);
  if (siteRules.length === 0 && !heuristicsAllowed && siteBehaviors.length === 0) return null;

  // Behaviors follow the same on/off as the rules: running while blocking is active on this host.
  // Each behavior runs while blocking is active on this host AND its category is enabled.
  const win = doc.defaultView;
  const running = new Map<string, () => void>();
  const syncBehaviors = (active: boolean, categories: readonly Category[]) => {
    for (const b of siteBehaviors) {
      const cleanup = running.get(b.id);
      if (win && active && categories.includes(b.category)) {
        if (!cleanup) running.set(b.id, b.start({ doc, win, path }));
        continue;
      }
      if (cleanup) {
        cleanup();
        running.delete(b.id);
      }
    }
  };

  syncBehaviors(true, CATEGORIES); // optimistic, like the blocker: before settings load

  const reporter = coalesce(report, reportIntervalMs);
  const blocker = createBlocker({
    doc,
    rules: siteRules,
    onCount: reporter.push,
    heuristics: heuristicsAllowed && DEFAULT_SETTINGS.heuristics,
  });
  blocker.start();

  let disposed = false;
  const apply = (stored: Settings) => {
    if (disposed) return;
    const settings = withDefaults(stored);
    const active = isBlockingActive(settings, host);
    const categories = enabledCategories(settings);
    syncBehaviors(active, categories);
    const heuristics = heuristicsAllowed && heuristicsEnabled(settings);
    const rulesInUse = siteRules.some((r) => categories.includes(r.category));
    // Before start(), so a restart never scans with stale switches.
    blocker.setHeuristics(heuristics);
    blocker.setCategories(categories);
    if (!active || (!rulesInUse && !heuristics)) blocker.stop();
    else blocker.start();
  };
  // The initial read can resolve after a change event (e.g. the user flips a switch while the page loads).
  // Once a change has arrived it is newer than the initial read, so the read is ignored.
  let changed = false;
  void settingsItem.getValue().then((value) => {
    if (!changed) apply(value);
  });
  const unwatch = settingsItem.watch((value) => {
    changed = true;
    apply(value);
  });

  return () => {
    disposed = true;
    unwatch();
    blocker.stop();
    syncBehaviors(false, []);
    reporter.cancel(); // the context is gone, so a late report would only fail
  };
}

/** Trailing coalescer: the first push schedules a flush, later pushes only update the value. */
function coalesce<T>(fn: (value: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: T;
  return {
    push: (value: T): void => {
      latest = value;
      timer ??= setTimeout(() => {
        timer = undefined;
        fn(latest);
      }, ms);
    },
    cancel: (): void => {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
