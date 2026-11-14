import { buildStylesheet, GROUP_ATTR, type Group, groupTagged, STYLE_ATTR, TAG_ATTR } from './css';
import {
  CONTROL_SELECTOR,
  findAiWidgets,
  HEURISTIC_PREFIX,
  isAiControl,
  isSafeToHide,
} from './heuristics';
import { type Category, CATEGORIES, type Rule } from './rule';
import { normalize } from './text';

export interface BlockerOptions {
  readonly doc: Document;
  /** Rules already filtered for the current host. */
  readonly rules: readonly Rule[];
  /** Called whenever the number of hidden elements changes. It's 0 while the blocker is stopped. */
  readonly onCount?: (count: number) => void;
  /** Run generic heuristics (T-009) in addition to the rules. Can be changed later with `setHeuristics`. */
  readonly heuristics?: boolean;
  /** Enabled categories (ADR-008). Defaults to all. Can be changed later with `setCategories`. */
  readonly categories?: Iterable<Category>;
}

export interface Blocker {
  /** Inject the stylesheet, scan the document once, then watch for insertions. Idempotent. */
  start(): void;
  /** Remove the stylesheet (everything becomes visible again) and stop watching. Idempotent. */
  stop(): void;
  /** Turn heuristics on/off. On: scans the document once. Off: their hits become visible again. */
  setHeuristics(on: boolean): void;
  /** Set the enabled categories. Newly enabled ones scan the document once; disabled ones become visible again. */
  setCategories(categories: Iterable<Category>): void;
  readonly active: boolean;
  readonly heuristics: boolean;
  readonly categories: readonly Category[];
  /** Elements currently hidden in this document (only enabled groups count). */
  readonly count: number;
}

/** Labels are short. Longer text can't be a label, so skip it cheaply. */
const MAX_LABEL_LENGTH = 120;

interface CompiledAnchor {
  readonly ruleId: string;
  readonly category: Category;
  readonly selector: string;
  readonly container: string;
  readonly matches: (text: string) => boolean;
}

function compileLabels(labels: readonly (string | RegExp)[]): (text: string) => boolean {
  const exact = new Set(labels.filter((l) => typeof l === 'string').map(normalize));
  const patterns = labels.filter((l) => l instanceof RegExp);
  return (text) => exact.has(text) || patterns.some((p) => p.test(text));
}

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;

/**
 * The DOM side of blocking. Uses only standard DOM APIs, so the same code runs in the content
 * script and in tests.
 *
 * Every hidden element is tagged with its rule id and its group (category, or `heuristic`). The stylesheet only hides
 * enabled groups, so switching a group is a stylesheet rewrite, plus one scan when a group is turned on.
 *
 * Cost model: work is proportional to inserted nodes. The document is fully scanned once per `start()` and once per
 * newly enabled group; each mutation batch only scans the subtrees that were added.
 */
export function createBlocker({
  doc,
  rules,
  onCount,
  heuristics = false,
  categories = CATEGORIES,
}: BlockerOptions): Blocker {
  const selectorTargets = rules.flatMap((rule) =>
    (rule.selectors ?? []).map((selector) => ({
      ruleId: rule.id,
      category: rule.category,
      selector,
    })),
  );
  const anchors: CompiledAnchor[] = rules.flatMap((rule) =>
    (rule.anchors ?? []).map((a) => ({
      ruleId: rule.id,
      category: rule.category,
      selector: a.selector,
      container: a.container,
      matches: compileLabels(a.labels),
    })),
  );

  let style: HTMLStyleElement | null = null;
  let observer: MutationObserver | null = null;
  let active = false;
  const enabled = new Set<Group>([...categories, ...(heuristics ? ['heuristic' as const] : [])]);
  const counts = new Map<Group, number>();

  const visibleCount = () => [...enabled].reduce((sum, g) => sum + (counts.get(g) ?? 0), 0);
  const emit = () => onCount?.(active ? visibleCount() : 0);
  /** Tags that currently hide something (enabled groups), or null if nothing is enabled. */
  const hidingSelector = () =>
    enabled.size === 0 ? null : [...enabled].map(groupTagged).join(', ');
  const isHiddenAlready = (el: Element) => {
    const selector = hidingSelector();
    return selector !== null && el.closest(selector) !== null;
  };
  const activeAnchors = () => anchors.filter((a) => enabled.has(a.category));

  function ensureStyle(): void {
    if (!style) {
      style = doc.createElement('style');
      style.setAttribute(STYLE_ATTR, '');
    }
    style.textContent = buildStylesheet(rules, enabled);
    if (style.isConnected) return;
    // At document_start <head> doesn't exist yet (the DOM typings claim it always does); <html> always does.
    const head = doc.head as HTMLHeadElement | null;
    (head ?? doc.documentElement).append(style);
  }

  /** Returns true if this call newly hid `el`. `id` is a rule id or `heuristic.<kind>`. */
  function hide(el: Element, id: string, group: Group): boolean {
    if (el === doc.documentElement || el === doc.body || el === doc.head) return false;
    if (isHiddenAlready(el)) return false; // already hidden (itself or an ancestor)
    const previous = el.getAttribute(GROUP_ATTR) as Group | null; // a stale tag from a disabled group
    if (previous !== null) counts.set(previous, (counts.get(previous) ?? 1) - 1);
    el.setAttribute(TAG_ATTR, id);
    el.setAttribute(GROUP_ATTR, group);
    counts.set(group, (counts.get(group) ?? 0) + 1);
    return true;
  }

  function checkAnchor(candidate: Element, anchor: CompiledAnchor): boolean {
    const text = candidate.textContent;
    const aria = candidate.getAttribute('aria-label');
    const textMatches = text.length <= MAX_LABEL_LENGTH && anchor.matches(normalize(text));
    if (!textMatches && !(aria !== null && anchor.matches(normalize(aria)))) return false;
    const container = candidate.closest(anchor.container);
    return container !== null && hide(container, anchor.ruleId, anchor.category);
  }

  /** Scan `root` and its subtree for the enabled groups. Returns true if anything was newly hidden. */
  function scan(root: Element): boolean {
    let changed = false;
    for (const { ruleId, category, selector } of selectorTargets) {
      if (!enabled.has(category)) continue;
      if (root.matches(selector)) changed = hide(root, ruleId, category) || changed;
      for (const el of root.querySelectorAll(selector))
        changed = hide(el, ruleId, category) || changed;
    }
    for (const anchor of activeAnchors()) {
      if (root.matches(anchor.selector)) changed = checkAnchor(root, anchor) || changed;
      for (const el of root.querySelectorAll(anchor.selector)) {
        changed = checkAnchor(el, anchor) || changed;
      }
    }
    if (enabled.has('heuristic')) {
      for (const hit of findAiWidgets(root)) {
        changed = hide(hit.element, `${HEURISTIC_PREFIX}${hit.kind}`, 'heuristic') || changed;
      }
    }
    return changed;
  }

  /** Text inserted into an existing element can complete a label (e.g. streamed HTML), so re-check it. */
  function scanTextParent(parent: Element): boolean {
    let changed = false;
    const anchorsNow = activeAnchors();
    const candidate =
      anchorsNow.length > 0 ? parent.closest(anchorsNow.map((a) => a.selector).join(', ')) : null;
    if (candidate) {
      for (const anchor of anchorsNow) {
        if (candidate.matches(anchor.selector)) changed = checkAnchor(candidate, anchor) || changed;
      }
    }
    if (enabled.has('heuristic')) {
      const control = parent.closest(CONTROL_SELECTOR);
      if (control && isAiControl(control) && isSafeToHide(control)) {
        changed = hide(control, `${HEURISTIC_PREFIX}control`, 'heuristic') || changed;
      }
    }
    return changed;
  }

  function onMutations(records: MutationRecord[]): void {
    if (!style?.isConnected) ensureStyle(); // the page may have removed or replaced <head>
    const checkText = activeAnchors().length > 0 || enabled.has('heuristic');
    let changed = false;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (isElement(node)) {
          if (node === style || isHiddenAlready(node)) continue;
          changed = scan(node) || changed;
        } else if (checkText && node.nodeType === Node.TEXT_NODE && node.parentElement) {
          changed = scanTextParent(node.parentElement) || changed;
        }
      }
    }
    if (changed) emit();
  }

  /** Replace the enabled set. Rewrites the stylesheet; scans once if a group was added. */
  function applyEnabled(next: ReadonlySet<Group>): void {
    const added = [...next].some((g) => !enabled.has(g));
    const removed = [...enabled].some((g) => !next.has(g));
    if (!added && !removed) return;
    enabled.clear();
    for (const g of next) enabled.add(g);
    if (!active) return; // applied on the next start()
    ensureStyle();
    if (added) scan(doc.documentElement);
    emit();
  }

  return {
    start() {
      if (active) return;
      active = true;
      ensureStyle();
      scan(doc.documentElement);
      observer = new MutationObserver(onMutations);
      observer.observe(doc.documentElement, { childList: true, subtree: true });
      emit();
    },
    stop() {
      if (!active) return;
      active = false;
      observer?.disconnect();
      observer = null;
      style?.remove();
      emit();
    },
    setHeuristics(on) {
      const next = new Set(enabled);
      if (on) next.add('heuristic');
      else next.delete('heuristic');
      applyEnabled(next);
    },
    setCategories(next) {
      const groups = new Set<Group>(next);
      if (enabled.has('heuristic')) groups.add('heuristic');
      applyEnabled(groups);
    },
    get active() {
      return active;
    },
    get heuristics() {
      return enabled.has('heuristic');
    },
    get categories() {
      return CATEGORIES.filter((c) => enabled.has(c));
    },
    get count() {
      return visibleCount();
    },
  };
}
