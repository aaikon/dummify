import { hostMatches } from './host';

/** The kinds of content dummify hides. Each has its own switch in the popup (ADR-008). */
export const CATEGORIES = ['ai', 'short-form', 'suggestions'] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * One blockable feature on one family of sites: an AI feature (Google's AI Overview), short-form video
 * (YouTube Shorts), or an automated suggestion (YouTube's "Up next"). All kinds share one switch (ADR-004).
 * Rules are plain data. All behavior lives in the engine (./engine.ts).
 */
export interface Rule {
  /** Stable `<site>.<feature>` id, e.g. `google.ai-overview`. Written to the `data-dummify` attribute. */
  readonly id: string;
  /** Human-readable summary, shown in docs and debugging. */
  readonly description: string;
  /** Which switch this rule follows (AI features / short-form video / suggestions). */
  readonly category: Category;
  /** Host patterns this rule applies to. See {@link hostMatches}. */
  readonly hosts: readonly string[];
  /**
   * CSS selectors for elements to hide. These go into a stylesheet injected at document_start,
   * so they're hidden **before first paint**. Prefer these whenever the feature has a stable selector.
   */
  readonly selectors?: readonly string[];
  /**
   * Label-based detection for features without a stable selector. It finds an element by its visible
   * text or aria-label, then hides its closest container. This runs in JS on DOM insertion, so it can
   * flash briefly. Use selectors when possible.
   */
  readonly anchors?: readonly TextAnchor[];
}

export interface TextAnchor {
  /** Candidate label elements, e.g. `h2, [role="heading"]`. Keep it narrow: it's queried on every insertion. */
  readonly selector: string;
  /**
   * Labels to match against the candidate's text and its `aria-label`, both normalized: trimmed, whitespace
   * collapsed, lowercased. A string must match **exactly** (precision over recall), and a RegExp is tested as-is.
   * Include localized labels.
   */
  readonly labels: readonly (string | RegExp)[];
  /** Selector for the ancestor (or self) to hide, resolved with `Element.closest`. */
  readonly container: string;
}

/** The rules that apply to a normalized host. */
export function rulesForHost(rules: readonly Rule[], host: string): Rule[] {
  return rules.filter((rule) => rule.hosts.some((pattern) => hostMatches(host, pattern)));
}
